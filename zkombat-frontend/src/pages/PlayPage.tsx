import { useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Copy, Check, Wallet, ExternalLink } from "lucide-react"
import { TopBar } from "../components/TopBar"
import { CharacterSelect } from "../components/CharacterSelect"
import type { Character } from "../components/CharacterSelect"
import { useWebRTC } from "../webrtc/useWebRTC"
import { useWalletStandalone } from "../hooks/useWalletStandalone"
import { FightingGame } from "../game/FightingGame"
import { InputRecorder } from "../zk/InputRecorder"
import { ProofGenerator } from "../zk/ProofGenerator"
import { ZkombatService } from "../games/zkombat/zkombatService"
import { ZKOMBAT_CONTRACT, STELLAR_EXPERT_URL } from "../utils/constants"
import { ensureTestnetAccountFunded } from "../utils/simulationUtils"
import type { GameResult } from "../game/engine/types"
import "./PlayPage.css"

const SIGNALING_URL =
  import.meta.env.VITE_SIGNALING_URL || "wss://zkombat-production.up.railway.app"
const zkombatService = new ZkombatService(ZKOMBAT_CONTRACT)

type PlayPhase =
  | "lobby"
  | "waiting"
  | "connecting"
  | "character-select"
  | "ready"
  | "fighting"
  | "generating-proof"
  | "submitting-proof"
  | "waiting-opponent"
  | "match-result"

export function PlayPage() {
  const navigate = useNavigate()
  const { publicKey, isConnected, getContractSigner, connect, isConnecting } =
    useWalletStandalone()
  const {
    connectionState,
    roomId,
    isHost,
    error,
    rawMessage,
    createRoom,
    joinRoom,
    sendRaw,
    disconnect,
  } = useWebRTC(SIGNALING_URL)

  const [phase, setPhase] = useState<PlayPhase>("lobby")
  const [joinInput, setJoinInput] = useState("")
  const [copied, setCopied] = useState(false)
  const [localChar, setLocalChar] = useState<Character | null>(null)
  const [remoteChar, setRemoteChar] = useState<Character | null>(null)
  const [matchResult, setMatchResult] = useState<GameResult | null>(null)
  const [proofStatus, setProofStatus] = useState("")
  const [txHash, setTxHash] = useState<string | null>(null)

  // ZK proof generation
  const recorderRef = useRef(new InputRecorder())
  const proofGenRef = useRef<ProofGenerator | null>(null)
  const healthRef = useRef({ p1: 0, p2: 0 })
  const sessionIdRef = useRef<number | null>(null)

  /* -- Sync WebRTC state -> phase -- */
  useEffect(() => {
    switch (connectionState) {
      case "connecting":
      case "signaling":
      case "reconnecting":
        setPhase("connecting")
        break
      case "waiting":
        setPhase("waiting")
        break
      case "connected":
        setPhase("character-select")
        break
      case "disconnected":
        if (
          phase !== "ready" &&
          phase !== "fighting" &&
          !phase.includes("proof") &&
          phase !== "match-result"
        ) {
          setPhase("lobby")
        }
        break
    }
  }, [connectionState])

  const handleCopy = async () => {
    if (!roomId) return
    try {
      await navigator.clipboard.writeText(roomId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const handleCharacterComplete = useCallback(
    (local: Character, remote: Character) => {
      setLocalChar(local)
      setRemoteChar(remote)
      setPhase("ready")
    },
    [],
  )

  const handleBack = () => {
    disconnect()
    navigate("/select-game")
  }

  const handleCancel = () => {
    disconnect()
    setPhase("lobby")
    setJoinInput("")
  }

  /* -- Handle game end: start ZK proof generation -- */
  const handleGameEnd = useCallback(
    async (result: GameResult, p1Health: number, p2Health: number) => {
      setMatchResult(result)
      healthRef.current = { p1: p1Health, p2: p2Health }
      recorderRef.current.stop()

      setPhase("generating-proof")
      setProofStatus("Generating anti-cheat proof...")

      try {
        // Initialize proof generator if needed
        if (!proofGenRef.current) {
          proofGenRef.current = new ProofGenerator()
          setProofStatus("Loading ZK circuit...")
          await proofGenRef.current.init()
        }

        setProofStatus("Computing witness & generating proof...")
        const inputs = recorderRef.current.getInputs()
        const numValid = recorderRef.current.getValidCount()

        // From local player's perspective
        const myHealth = isHost ? p1Health : p2Health
        const oppHealth = isHost ? p2Health : p1Health

        const proof = await proofGenRef.current.generateProof(
          inputs,
          numValid,
          myHealth,
          oppHealth,
        )

        console.log("[PlayPage] ZK proof generated:", {
          proofSize: proof.proofBytes.length,
          publicInputs: proof.publicInputs,
          submission: proof.submission,
        })

        // Try on-chain proof submission if wallet is connected and match exists
        console.log("[PlayPage] Submission check:", {
          isConnected,
          publicKey,
          sessionId: sessionIdRef.current,
        })
        if (isConnected && publicKey && sessionIdRef.current !== null) {
          setProofStatus("Preparing account...")
          setPhase("submitting-proof")
          try {
            // Ensure player's account exists on testnet (fund via Friendbot if needed)
            await ensureTestnetAccountFunded(publicKey)
            setProofStatus("Submitting proof to Stellar...")
            console.log(
              "[PlayPage] Submitting proof on-chain, sessionId:",
              sessionIdRef.current,
              "player:",
              publicKey,
            )
            const signer = getContractSigner()
            const { txHash: hash } = await zkombatService.submitProof(
              sessionIdRef.current,
              publicKey,
              proof.proofBytes,
              proof.submission.input_hash,
              proof.submission.my_final_health,
              proof.submission.opponent_final_health,
              proof.submission.total_damage_dealt,
              proof.submission.i_won,
              signer,
            )
            console.log(
              "[PlayPage] Proof submitted successfully, txHash:",
              hash,
            )
            if (hash) setTxHash(hash)
            setProofStatus("Proof verified on-chain!")
          } catch (chainErr) {
            console.error("[PlayPage] On-chain submission failed:", chainErr)
            const errMsg =
              chainErr instanceof Error ? chainErr.message : String(chainErr)
            setProofStatus(
              `On-chain submission failed: ${errMsg.slice(0, 120)}`,
            )
          }
        } else {
          console.warn("[PlayPage] Skipping on-chain submission:", {
            isConnected,
            publicKey,
            sessionId: sessionIdRef.current,
          })
          setProofStatus("Proof generated successfully")
        }

        setPhase("match-result")
      } catch (err) {
        console.error("[PlayPage] Proof generation failed:", err)
        setProofStatus(
          `Proof generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        )
        // Still show result even if proof fails
        setTimeout(() => setPhase("match-result"), 3000)
      }
    },
    [isHost, isConnected, publicKey, getContractSigner],
  )

  /* -- Auto-transition: ready -> fighting -- */
  useEffect(() => {
    if (phase === "ready") {
      // Generate a session ID from the room code for on-chain tracking
      if (roomId && sessionIdRef.current === null) {
        let hash = 0
        for (let i = 0; i < roomId.length; i++) {
          hash = ((hash << 5) - hash + roomId.charCodeAt(i)) | 0
        }
        sessionIdRef.current = Math.abs(hash) % 2147483647
      }
      const id = setTimeout(() => setPhase("fighting"), 3000)
      return () => clearTimeout(id)
    }
  }, [phase, roomId])

  const playerSide = isHost ? "left" : "right"

  const resultText =
    matchResult === "tie"
      ? "Draw!"
      : matchResult === "player1"
        ? isHost
          ? "You Win!"
          : "You Lose!"
        : matchResult === "player2"
          ? isHost
            ? "You Lose!"
            : "You Win!"
          : ""

  return (
    <div className="play-page relative min-h-screen overflow-x-hidden bg-[#07080c] text-white">
      <div className="play-page-bg" />
      <TopBar />

      {/* Back */}
      <div className="absolute top-16 left-5 z-20 md:left-10">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-[11px] font-medium text-white/30 transition-colors hover:text-white/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 pt-20 pb-10">
        {/* -- LOBBY -- */}
        {phase === "lobby" && (
          <div className="play-lobby">
            {!isConnected ? (
              <div className="play-wallet-gate">
                <div className="play-wallet-icon">
                  <Wallet className="h-5 w-5" />
                </div>
                <h2 className="play-lobby-title">Connect Wallet</h2>
                <p
                  className="play-lobby-sub"
                  style={{ marginBottom: "1.5rem" }}
                >
                  Connect your Stellar wallet to start playing
                </p>
                <button
                  className="play-btn-primary"
                  onClick={() => connect().catch(() => undefined)}
                  disabled={isConnecting}
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </button>
              </div>
            ) : (
              <>
                <div className="play-lobby-header">
                  <h2 className="play-lobby-title">Match Lobby</h2>
                  <p className="play-lobby-sub">
                    Create a room or join with a code
                  </p>
                </div>

                {error && <div className="play-error">{error}</div>}

                <button
                  className="play-btn-primary"
                  onClick={() => createRoom()}
                >
                  Create Room
                </button>

                <div className="play-divider">
                  <div className="play-divider-line" />
                  <span className="play-divider-text">or</span>
                  <div className="play-divider-line" />
                </div>

                <div className="play-join-row">
                  <input
                    type="text"
                    placeholder="Enter room code"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                    maxLength={6}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && joinInput.trim())
                        joinRoom(joinInput.trim())
                    }}
                  />
                  <button
                    className="play-btn-join"
                    onClick={() =>
                      joinInput.trim() && joinRoom(joinInput.trim())
                    }
                    disabled={!joinInput.trim()}
                  >
                    Join
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* -- WAITING -- */}
        {phase === "waiting" && (
          <div className="play-lobby">
            <div className="play-waiting">
              <span className="play-waiting-badge">Room Created</span>
              <p className="play-waiting-label">
                Share this code with your opponent
              </p>
              <div className="play-waiting-code">{roomId}</div>

              <button onClick={handleCopy} className="play-copy-btn">
                {copied ? (
                  <>
                    <Check className="h-3 w-3" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" /> Copy code
                  </>
                )}
              </button>

              <p className="play-waiting-status">
                Waiting for opponent
                <span className="play-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </p>

              <div style={{ marginTop: "1.75rem" }}>
                <button className="play-btn-secondary" onClick={handleCancel}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* -- CONNECTING -- */}
        {phase === "connecting" && (
          <div className="play-lobby">
            <div className="play-connecting">
              <div className="play-spinner" />
              <h3 className="play-connecting-title">Connecting</h3>
              <p className="play-connecting-sub">
                Establishing peer-to-peer connection
              </p>
            </div>
          </div>
        )}

        {/* -- READY -- */}
        {phase === "ready" && (
          <div className="play-ready">
            <h2 className="play-ready-title">Ready to Fight</h2>
            <div className="play-ready-matchup">
              {localChar && (
                <div className="play-ready-fighter">
                  <img
                    src={localChar.portrait}
                    alt={localChar.name}
                    style={{ border: "2px solid #00c8ff" }}
                  />
                  <p
                    className="play-ready-fighter-name"
                    style={{ color: "#00c8ff" }}
                  >
                    {localChar.name}
                  </p>
                  <p className="play-ready-fighter-label">You</p>
                </div>
              )}
              <span className="play-ready-vs">VS</span>
              {remoteChar && (
                <div className="play-ready-fighter">
                  <img
                    src={remoteChar.portrait}
                    alt={remoteChar.name}
                    style={{ border: "2px solid #ff3264" }}
                  />
                  <p
                    className="play-ready-fighter-name"
                    style={{ color: "#ff3264" }}
                  >
                    {remoteChar.name}
                  </p>
                  <p className="play-ready-fighter-label">Opponent</p>
                </div>
              )}
            </div>
            <p className="play-ready-hint">Game will start shortly...</p>
          </div>
        )}

        {/* -- PROOF GENERATION / SUBMISSION -- */}
        {(phase === "generating-proof" ||
          phase === "submitting-proof" ||
          phase === "waiting-opponent") && (
          <div className="play-lobby">
            <div className="play-connecting">
              <div className="play-spinner" />
              <h3 className="play-connecting-title">
                {phase === "generating-proof" && "Generating Proof"}
                {phase === "submitting-proof" && "Submitting Proof"}
                {phase === "waiting-opponent" && "Waiting for Opponent"}
              </h3>
              <p className="play-connecting-sub">{proofStatus}</p>
            </div>
          </div>
        )}

        {/* -- MATCH RESULT -- */}
        {phase === "match-result" && (
          <div className="play-lobby">
            <div className="play-waiting">
              <h2
                className="play-lobby-title"
                style={{ fontSize: "28px", marginBottom: "1rem" }}
              >
                {resultText}
              </h2>
              <p
                className="play-waiting-label"
                style={{ marginBottom: "0.5rem" }}
              >
                P1 Health: {healthRef.current.p1} | P2 Health:{" "}
                {healthRef.current.p2}
              </p>
              <p
                className="play-waiting-label"
                style={{ fontSize: "10px", opacity: 0.5 }}
              >
                {proofStatus || "ZK proof generated"}
              </p>

              {txHash && (
                <div style={{ marginTop: "1rem" }}>
                  <span className="play-tx-confirmed">Verified On-Chain</span>
                  <p className="play-tx-hash">
                    {txHash.slice(0, 8)}...{txHash.slice(-8)}
                  </p>
                  <a
                    className="play-tx-link"
                    href={`${STELLAR_EXPERT_URL}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View on Stellar Expert <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              <div style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
                <button
                  className="play-btn-primary"
                  onClick={() => {
                    setPhase("lobby")
                    setMatchResult(null)
                    setTxHash(null)
                    recorderRef.current = new InputRecorder()
                  }}
                >
                  Play Again
                </button>
                <button className="play-btn-secondary" onClick={handleBack}>
                  Exit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* -- FIGHTING -- */}
      {phase === "fighting" && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black">
          <FightingGame
            isHost={isHost}
            sendRaw={sendRaw}
            rawMessage={rawMessage}
            onGameEnd={handleGameEnd}
            inputRecorder={recorderRef.current}
            p1CharacterId={isHost ? localChar?.id : remoteChar?.id}
            p2CharacterId={isHost ? remoteChar?.id : localChar?.id}
          />
        </div>
      )}

      {/* Character selection overlay */}
      <CharacterSelect
        isOpen={phase === "character-select"}
        playerSide={playerSide}
        sendRaw={sendRaw}
        rawMessage={rawMessage}
        onComplete={handleCharacterComplete}
      />
    </div>
  )
}
