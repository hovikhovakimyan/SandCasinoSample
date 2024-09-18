import Phaser from "phaser";
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext.js";
import { useBalance } from "../../contexts/BalanceContext.js";
import PlinkoBettingWindow from "./PlinkoBettingWindow";
import { supabase, fetchAndUpdateBalance } from "../../api/supabaseClient";
import border from '../../assets/borders.png';
import bounceSound from '../../assets/plinko_bounce.mp3';
import dropSound from '../../assets/plinko_drop.mp3';
import bucketPointsConfig from "./bucketPointsConfig";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { toast } from 'react-toastify';
import bankpinfail from '../../assets/bankpinfail.mp3';
import { sleep } from "../../utils/sleep";
import { useVolume } from "../../contexts/VolumeContext";
import { useBet } from '../../hooks/useBet';


let globalPlayerId = null;
let globalFetchBalances = null;
let globalVolumes = null;
let globalMutedStates = null;
const gameDelay = 1000;

class MainScene extends Phaser.Scene {
  constructor() {
    super('MainScene');
    this.plinkoObjects = [];
    this.bucketWidth = 35;
    this.bucketHeight = 30;
    this.bucketColor = 0xA58C6B;
    this.risk = 'High'; // Default value
    this.rows = 16; // Default value
    this.maxSimultaneousSounds = 12;
    this.playingSounds = 0;
  }
  preload() {
    this.load.audio('bounceSound', bounceSound);
    this.load.audio('dropSound', dropSound);
  }

  create() {
    this.createGameObjects();
    this.matter.world.on("collisionstart", this.handleCollisions.bind(this));
    this.events.on('shutdown', this.shutdown, this);
    this.game.events.on('hidden', () => {
      this.scene.pause();
      this.game.sound.pauseAll();
    });

    this.game.events.on('visible', () => {
      this.scene.resume();
      this.game.sound.resumeAll();
    });
  }

  init(data) {
    this.risk = data.risk;
    this.rows = data.rows;
  }

  createGameObjects() {
    const pegRows = this.rows;
    const pegStartCol = 3;
    const pegRadius = 5;
    const pegColor = 0xFFFFFF;
    const canvasCenterX = this.game.config.width / 2;
    const canvasHeight = this.game.config.height;
    const pegSpacing = 40; // Vertical spacing between pegs
    const totalPegsHeight = pegRows * pegSpacing;
    const startY = (canvasHeight - totalPegsHeight) / 2; // Start Y position centered

    for (let i = 0; i < pegRows; i++) {
      const pegCols = pegStartCol + i;
      for (let j = 0; j < pegCols; j++) {
        const x = canvasCenterX + (j - (pegCols - 1) / 2) * 40;
        const y = startY + i * pegSpacing;
        const pegObject = this.add.circle(x, y, pegRadius, pegColor);
        this.matter.add.gameObject(pegObject, {
          isStatic: true,
          shape: { type: "circle", radius: pegRadius },
          label: "peg",
        });
      }
    }

    const bucketPoints = bucketPointsConfig[this.risk][this.rows];
    this.bucketPoints = bucketPoints; // Store bucketPoints as a class property
    const bucketSpacing = 5;
    const totalBucketsWidth = bucketPoints.length * (this.bucketWidth + bucketSpacing) - bucketSpacing;
    const bucketsStartX = canvasCenterX - totalBucketsWidth / 2 + this.bucketWidth / 2;
    const finalY = startY + totalPegsHeight; // Position buckets at the end of the pegs

    for (let i = 0; i < bucketPoints.length; i++) {
      const x = bucketsStartX + i * (this.bucketWidth + bucketSpacing);
      const y = finalY;
      const distanceFromCenter = Math.abs(i - Math.floor(bucketPoints.length / 2));
      const colorRatio = distanceFromCenter / Math.floor(bucketPoints.length / 2);
      const bucketColor = Phaser.Display.Color.Interpolate.ColorWithColor(
        new Phaser.Display.Color(255, 150, 0),
        new Phaser.Display.Color(0, 255, 0),
        Math.floor(bucketPoints.length / 2),
        distanceFromCenter
      );

      const finalColor = Phaser.Display.Color.GetColor(bucketColor.r, bucketColor.g, bucketColor.b);
      const bucketGraphics = this.add.graphics({ fillStyle: { color: finalColor } });

      let bucketWidth = this.bucketWidth;
      let bucketX = x - this.bucketWidth / 2;
      let textX = x;
      const cornerRadius = 10; // Adjust the corner radius as needed

      // Adjust width and position for edge buckets
      if (i === 0) {
        bucketWidth += 10;
        bucketX -= 10;
        textX -= 5;
      } else if (i === bucketPoints.length - 1) {
        bucketWidth += 10;
        textX += 5;
      }

      bucketGraphics.fillStyle(0x000000, 0.5);
      bucketGraphics.fillRoundedRect(bucketX + 3, y - this.bucketHeight / 2 + 3, bucketWidth, this.bucketHeight, cornerRadius);

      bucketGraphics.fillStyle(finalColor);
      bucketGraphics.fillRoundedRect(bucketX, y - this.bucketHeight / 2, bucketWidth, this.bucketHeight, cornerRadius);

      const bucketObject = this.matter.add.rectangle(x, y, bucketWidth, this.bucketHeight, {
        isStatic: true,
        isSensor: true,
        label: bucketPoints[i],
        index: i,
        bucketX: bucketX,
        bucketWidth: bucketWidth
      });
      bucketObject.graphics = bucketGraphics;
      this.add.text(textX, y, bucketPoints[i].toString() + "x", {
        fontSize: "12px",
        fontWeight: "bold",
        color: "#FFFFFF",
        stroke: '#000000',
        strokeThickness: 3,
        shadow: {
          offsetX: 2,
          offsetY: 2,
          color: '#000000',
          blur: 4,
          stroke: true,
          fill: true
        }
      }).setOrigin(0.5);
    }
  }

  createPlinko(plinkoId, path, multiplier) {
    const canvasCenterX = this.game.config.width / 2;
    let plinkoObject = this.add.circle(canvasCenterX, 0, 12, 0xFF7F7F);
    let plinko = this.matter.add.gameObject(plinkoObject, {
      restitution: 0.01,
      friction: 0.8,
      shape: { type: "circle", radius: 10 },
    });
    let lastPeg = 0;
    let predetermined = path;
    let predIndex = 0;

    this.plinkoObjects.push({
      plinkoId,
      plinkoObject,
      plinko,
      lastPeg,
      predetermined,
      predIndex,
      multiplier
    });
  }
  playLimitedSound(key) {
    if (this.playingSounds < this.maxSimultaneousSounds) {
      this.playingSounds++;
      const sound = this.sound.add(key);
      sound.once('complete', () => {
        this.playingSounds--;
      });
      sound.play();
    }
  }

  handleCollisions(event) {
    event.pairs.forEach(pair => {
      let ball = pair.bodyA.label !== 'Circle Body' ? pair.bodyB : pair.bodyA;
      let current = this.plinkoObjects.find(obj => obj.plinkoObject.body.id === ball.id);
      if (current) {
        if (pair.bodyA.label === "peg" || pair.bodyB.label === "peg") {
          if (pair.bodyA.id === current.lastPeg) {
            return;
          }
          this.sound.volume = globalMutedStates['plinko'] ? 0 : globalVolumes['plinko'];
          this.playLimitedSound('bounceSound');
          current.plinkoObject.setVelocity(0, 0);
          current.lastPeg = pair.bodyA.id;
          const direction = current.predetermined[current.predIndex];
          current.predIndex++;
          const velocityX = direction * 0.6;
          const velocityY = 0.3;
          current.plinkoObject.setPosition(pair.bodyA.position.x + (direction) * 1.2, pair.bodyB.position.y - 1);
          current.plinkoObject.setVelocity(velocityX, velocityY);

          // Add glow effect for peg hit
          const peg = pair.bodyA.label === "peg" ? pair.bodyA.gameObject : pair.bodyB.gameObject;
          const glow = this.add.graphics();
          glow.fillStyle(0xffffff, 0.5); // Yellow color with 50% opacity
          glow.fillCircle(peg.x, peg.y, 15); // Adjust the radius as needed

          this.tweens.add({
            targets: glow,
            alpha: 0,
            duration: 300,
            ease: 'Power1',
            onComplete: () => {
              glow.destroy();
            }
          });
        }
        if (pair.bodyA === current.plinko.body || pair.bodyB === current.plinko.body) {
          const bucket = pair.bodyA === current.plinko.body ? pair.bodyB : pair.bodyA;
          if (bucket && typeof bucket.label === "number") {
            this.sound.volume = globalMutedStates['plinko'] ? 0 : globalVolumes['plinko'];
            this.playLimitedSound('dropSound');
            // if (current.multiplier !== bucket.label) {
            //   console.log("FALSE PLINKO: ", current.plinkoId, " ", current.multiplier, " ", bucket.label);
            // }
            this.updateGameResult(current.plinkoId);
            this.plinkoObjects = this.plinkoObjects.filter(obj => obj.plinkoObject.body.id !== current.plinkoObject.body.id);
            current.plinkoObject.destroy();

            // Temporary color change logic
            const bucketIndex = bucket.index;
            const middleIndex = Math.floor(this.bucketPoints.length / 2);
            const distanceFromCenter = Math.abs(bucketIndex - middleIndex);
            const bucketColor = Phaser.Display.Color.Interpolate.ColorWithColor(
              new Phaser.Display.Color(255, 150, 0),
              new Phaser.Display.Color(0, 255, 0),
              middleIndex,
              distanceFromCenter
            );
            const finalColor = Phaser.Display.Color.GetColor(bucketColor.r, bucketColor.g, bucketColor.b);

            // Change bucket color temporarily
            bucket.graphics.clear();
            bucket.graphics.fillStyle(0x000000, 0.5);
            bucket.graphics.fillRoundedRect(bucket.bucketX + 3, bucket.position.y - this.bucketHeight / 2 + 3, bucket.bucketWidth, this.bucketHeight, 10);
            bucket.graphics.fillStyle("0x3364f6", 1); // Temporary color
            bucket.graphics.fillRoundedRect(bucket.bucketX, bucket.position.y - this.bucketHeight / 2, bucket.bucketWidth, this.bucketHeight, 10);

            this.time.delayedCall(1000, () => {
              bucket.graphics.clear();
              bucket.graphics.fillStyle(0x000000, 0.5);
              bucket.graphics.fillRoundedRect(bucket.bucketX + 3, bucket.position.y - this.bucketHeight / 2 + 3, bucket.bucketWidth, this.bucketHeight, 10);
              bucket.graphics.fillStyle(finalColor, 1);
              bucket.graphics.fillRoundedRect(bucket.bucketX, bucket.position.y - this.bucketHeight / 2, bucket.bucketWidth, this.bucketHeight, 10);
            });
          }
        }
      }
    });
  }
  startAutoPlay(callback) {
    this.autoPlayEvent = this.time.addEvent({
      delay: gameDelay,
      callback: callback,
      loop: true
    });
  }

  stopAutoPlay() {
    if (this.autoPlayEvent) {
      this.autoPlayEvent.remove();
      this.autoPlayEvent = null;
    }
  }

  shutdown() {
    // Remove event listeners or other cleanup tasks
    this.matter.world.off('collisionstart', this.handleCollisions, this);
  }

  async updateGameResult(plinkoId) {
    const { data, error } = await supabase.rpc('end_plinko', { plinko_id: plinkoId, v_player_id: globalPlayerId });
    if (error) {
      console.error(error);
    }
    await globalFetchBalances();
  }
}


export default function Plinko() {
  const {
    bet,
    setBet,
    handleBetChange,
    handleBetBlur,
    handleHalfBet,
    handleDoubleBet,
  } = useBet(0);

  const [gameOver, setGameOver] = useState(false);
  const [game, setGame] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [recovering, setRecovering] = useState(true);
  const [risk, setRisk] = useState("");
  const [rows, setRows] = useState(8);
  const [gameActive, setGameActive] = useState(false);

  const [autoPlayIntervalId, setAutoPlayIntervalId] = useState(null);
  const [numberOfGames, setNumberOfGames] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const isActiveRef = useRef(false);
  const autoBetTimeOut = useRef(false);

  const [mode, setMode] = useState('Manual');

  const [shake, setShake] = useState(false);
  const bankPinSound = new Audio(bankpinfail);

  const gameRef = useRef(null);
  const initializing = useRef(true);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(speed);




  const { session, signedIn } = useAuth();
  const { MAXBET, balanceType, changeBalanceType, fetchBalances, getActiveBalance, setDisableModifications } = useBalance();
  const { mutedStates, volumes, setActiveGame } = useVolume();

  const moneyRef = useRef(getActiveBalance());
  useEffect(() => {
    moneyRef.current = getActiveBalance();
  }, [getActiveBalance()]);


  const initializeGame = (risk, rows) => {
    return new Promise((resolve, reject) => {
      initializing.current = true;
      if (gameRef.current) {
        gameRef.current.destroy(true); // Destroy the existing game instance
      }

      const config = {
        type: Phaser.AUTO,
        width: 750,
        height: 750,
        parent: "gameContainer",
        physics: {
          default: "matter",
          matter: {
            gravity: { y: 0.03 },
            debug: false,
            timing: { timeScale: 10 * speedRef.current },
          },
        },
        scene: [MainScene],
        transparent: true,
        autoFocus: false,
      };

      const newGame = new Phaser.Game(config);
      gameRef.current = newGame;

      newGame.events.once('ready', () => {
        resolve(newGame);
      });

      newGame.scene.start('MainScene', { risk, rows }); // Pass the risk and rows as data
      initializing.current = false;
    });
  };
  async function startGame() {
    if (bet > moneyRef.current) {
      toast.error("Insufficient balance. Bet cannot be higher than balance.");
      bankPinSound.play();
      setGameStarted(false);
      setShake(true);
      setTimeout(() => {
        setShake(false);
      }, 200);
      return;
    }
    const { data, error } = await supabase.rpc("start_plinko", { v_bet: bet, v_player_id: session?.user.id, v_risk: risk, v_rows: rows, v_type: balanceType });
    if (error) {
      toast.error(error.message);
      stopAutoPlay();
      return;
    }
    await fetchBalances();
    gameRef.current && gameRef.current.scene.keys.MainScene.createPlinko(data.id, data.path, data.multiplier);
    setTimeout(() => {
      setGameStarted(false);
    }, gameDelay);
  }
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setNumberOfGames(0);
  };

  useEffect(() => {
    setActiveGame('plinko');

    return () => {
      if (gameRef.current) {
        //gameRef.current.sound.stopAll();
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    globalPlayerId = session?.user.id;
    globalFetchBalances = fetchBalances;
  }, [session?.user.id, fetchBalances]);

  useEffect(() => {
    globalVolumes = volumes;
    globalMutedStates = mutedStates;
  }, [volumes, mutedStates]);

  useEffect(() => {
    const fetchActiveGame = async () => {
      const { data, error } = await supabase.rpc("plinko_fetch_active", { v_player_id: session?.user.id });
      if (error) {
        console.error("Error fetching active game:", error);
        return;
      }
      if (data && data.length > 0) {
        initializing.current = true;
        setGameActive(true);
        setRecovering(true);
        changeBalanceType(data[0].type);
        setBet(data[0].bet);
        setRows(data[0].rows);
        setRisk(data[0].risk);
        await initializeGame(data[0].risk, data[0].rows); // Await the game initialization
        initializing.current = false;
        await sleep(1000);
        for (let i = 0; i < data.length; i++) {
          setTimeout(() => {
            gameRef.current && gameRef.current.scene.keys.MainScene.createPlinko(data[i].id, data[i].path, data[i].multiplier);
          }, i * gameDelay);
          setTimeout(() => {
            setRecovering(false);

          }, gameDelay * data.length + gameDelay);
        }
      } else {
        setRecovering(false);
        initializing.current = false;
        setRisk("High");
        setRows(16);
      }
    };
    if (gameRef)
      if (session?.user.id.length > 0) {
        setTimeout(() => {
          fetchActiveGame();
        }, 1000);
      } else {
        setRecovering(false);
        initializing.current = false;
        setRisk("High");
        setRows(16);
      }
  }, [session?.user.id, gameRef]);

  useEffect(() => {
    if (gameStarted && !recovering && !isActiveRef.current) {
      startGame();
    }
  }, [gameStarted, recovering]);

  useEffect(() => {
    if (!initializing.current) {
      initializeGame(risk, rows);
    }
  }, [risk, rows]);
  useEffect(() => {
    speedRef.current = speed;
    if (!initializing.current) {
      initializeGame(risk, rows);
    }
  }, [speed])
  useEffect(() => {
    const updateGameActive = (plinkoObjects) => {
      if (plinkoObjects.length > 0) {
        setGameActive(true);
      } else {
        setGameActive(false);
      }
    }
    if (gameRef.current?.scene?.keys?.MainScene?.plinkoObjects) {
      updateGameActive(gameRef.current.scene.keys.MainScene.plinkoObjects);
    }
  }, [gameRef.current?.scene?.keys?.MainScene?.plinkoObjects?.length]);
  const startAutoPlay = () => {
    isActiveRef.current = true;
    setGameStarted(true);
    let gamesCount = 0;

    const autoPlayCallback = async () => {
      if (gamesCount >= numberOfGames || !isActiveRef.current || bet > moneyRef.current) {
        stopAutoPlay();
        setGameStarted(false);
        setGameOver(true);
        isActiveRef.current = false;
        if (bet > moneyRef.current) {
          toast.error("Insufficient balance. Bet cannot be higher than balance.");
          bankPinSound.play();
          setShake(true);
          setTimeout(() => {
            setShake(false);
          }, 200);
        }
        return;
      }
      await startGame();
      gamesCount++;
      setGamesPlayed(gamesCount);
    };

    if (gameRef.current && gameRef.current.scene.keys.MainScene) {
      gameRef.current.scene.keys.MainScene.startAutoPlay(autoPlayCallback);
    }
  };

  const stopAutoPlay = () => {
    if (gameRef.current && gameRef.current.scene.keys.MainScene) {
      gameRef.current.scene.keys.MainScene.stopAutoPlay();
    }
    isActiveRef.current = false;
    setGameStarted(false);
    setGameOver(true);
    autoBetTimeOut.current = true;
    autoBetTimeOut.current = false;
  };

  useEffect(() => {
    return () => {
      stopAutoPlay(); // Cleanup on component unmount
    };
  }, [autoPlayIntervalId]);
  useEffect(() => {
    setDisableModifications(gameStarted || gameActive || isActiveRef.current);
  }, [gameStarted, gameActive, isActiveRef.current])
  useEffect(() => {
    return () => {
      setDisableModifications(false);
    }
  }, [])

  return (
    <div className="main-container justify-center">
      <PlinkoBettingWindow
        bet={bet}
        handleAmountChange={handleBetChange}
        handleBetBlur={handleBetBlur}
        handleHalfBet={handleHalfBet}
        handleDoubleBet={handleDoubleBet}
        startGame={() => setGameStarted(true)}
        signedIn={signedIn}
        gameStarted={gameStarted || recovering || isActiveRef.current}
        rows={rows}
        handleRowsChange={(e) => setRows(Number(e.target.value))}
        risk={risk}
        handleRiskChange={(e) => setRisk(e.target.value)}
        disableModifications={gameStarted || gameActive || isActiveRef.current || initializing.current}
        numberOfGames={numberOfGames}
        onModeChange={(newMode) => handleModeChange(newMode)}
        setNumberOfGames={(e) => { setNumberOfGames(parseInt(e.target.value)) }}
        startAutoPlay={startAutoPlay}
        stopAutoPlay={stopAutoPlay}
        autoBetTimeOut={autoBetTimeOut.current}
        shake={shake}
        balanceType={balanceType}
        speed={speed}
        setSpeed={setSpeed}
      />

      <div className="flex items-center justify-center min-w-[200px] min-h-[200px] max-w-[808px] game-container">
        {initializing.current ? <div className="min-w-[808px] flex flex-col flex-grow items-center justify-center w-full p-6">
          <AiOutlineLoading3Quarters className="text-8xl text-white text-center animate-spin" />
          <p className="text-white text-center text-xl font-bold mt-2">Initializing</p>
        </div> : null}
        <div id="gameContainer" className={`flex flex-grow items-center justify-center w-full ${initializing.current ? "hidden" : ""}`} />
      </div>
    </div>
  );
}
