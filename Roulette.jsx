import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../../contexts/AuthContext.js";
import { useBalance } from "../../contexts/BalanceContext.js";
import Balls from "./Balls";
import MobileBalls from "./MobileBalls";
import "./Roulette.css";
import { PiPokerChipFill } from "react-icons/pi";
import { PiCoinFill, PiCoinsFill } from "react-icons/pi";
import { GoldCoin, SilverCoin } from "../Coins";
import { FaSpinner, FaTrash } from "react-icons/fa";
import { GrUndo } from "react-icons/gr";
import Rowbet from "./Rowbet";
import GeneralChip from "../GeneralChip";
import EnhancedWinningsComponent from "../EnhancedWinningsComponent";
import DraggableChip from "./DraggableChip";
import Twelvebets from "./Twelvebets";
import withFadeInDelay from "../withFadeInDelay";
import ActionButton from "../Blackjack-component/ActionButtons";
import { VscDebugRestart } from "react-icons/vsc";
import { supabase, fetchAndUpdateBalance } from "../../api/supabaseClient.js";
import spinSound from "../../assets/roulette_spin.mp3";
import PropTypes from 'prop-types';
import { toast } from 'react-toastify';
import bankpinfail from '../../assets/bankpinfail.mp3';
import 'react-toastify/dist/ReactToastify.css';
import RulesComponent from '../../components/RulesComponent';
import { rouletteRules } from '../../components/gameRules';
import { useVolume } from '../../contexts/VolumeContext'; // Import useVolume hook
import VolumeControl from '../VolumeControl';
import SpeedControl from "../SpeedControl";
import { IoIosPhoneLandscape } from "react-icons/io";
import { RiFullscreenExitLine } from "react-icons/ri"; // Add this import


const FadedInWinningsComponent = withFadeInDelay(EnhancedWinningsComponent, 500);

const RouletteApp = () => {
  const { session, signedIn } = useAuth();
  const { MAXBET, balanceType, changeBalanceType, fetchBalances, getActiveBalance, setDisableModifications } = useBalance();
  const { volumes, mutedStates, setActiveGame } = useVolume(); // Use the useVolume hook to get volumes
  let betsObject = {
    "00": 0,
    "0": 0,
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
    "6": 0,
    "7": 0,
    "8": 0,
    "9": 0,
    "10": 0,
    "11": 0,
    "12": 0,
    "13": 0,
    "14": 0,
    "15": 0,
    "16": 0,
    "17": 0,
    "18": 0,
    "19": 0,
    "20": 0,
    "21": 0,
    "22": 0,
    "23": 0,
    "24": 0,
    "25": 0,
    "26": 0,
    "27": 0,
    "28": 0,
    "29": 0,
    "30": 0,
    "31": 0,
    "32": 0,
    "33": 0,
    "34": 0,
    "35": 0,
    "36": 0,
    "firstrow": 0,
    "secondrow": 0,
    "thirdrow": 0,
    "1to18": 0,
    "19to36": 0,
    "1to12": 0,
    "13to24": 0,
    "25to36": 0,
    "even": 0,
    "odd": 0,
    "red": 0,
    "black": 0,
  };
  const [game_id, setGame_id] = useState(0);
  const [selectedChip, setSelectedChip] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [currentBall, setCurrentBall] = useState("0");
  const [target, setTarget] = useState("00");
  const [bets, setBets] = useState(betsObject);
  const [lastBet, setLastBet] = useState(betsObject);
  const [beforeClear, setBeforeClear] = useState(betsObject);
  const [winningBets, setWinningBets] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [winnings, setWinnings] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [actionStack, setActionStack] = useState([]);
  const [gameFetched, setGameFetched] = useState(false);

  const [intervalId, setIntervalId] = useState(null);
  const [initialPlayId, setInitialPlayId] = useState(null);

  const [shake, setShake] = useState(false);
  const [speed, setSpeed] = useState(1);
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed])
  const bankPinSound = new Audio(bankpinfail);
  const audio = useRef(new Audio(spinSound));
  const gameUnmounted = useRef(false);



  const redNumbers = [
    1,
    3,
    5,
    7,
    9,
    12,
    14,
    16,
    18,
    19,
    21,
    23,
    25,
    27,
    30,
    32,
    34,
    36,
  ];

  const [isFullscreenLike, setIsFullscreenLike] = useState(false);
  const containerRef = useRef(null);

  const toggleFullscreenLike = () => {
    if (!isFullscreenLike) {
      enterFullscreenLike();
    } else {
      exitFullscreenLike();
    }
  };

  const enterFullscreenLike = () => {
    if (containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (containerRef.current.webkitRequestFullscreen) { // iOS Safari
        containerRef.current.webkitRequestFullscreen();
      }
      setIsFullscreenLike(true);
      document.body.classList.add('fullscreen-like');
    }
  };

  const exitFullscreenLike = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) { // iOS Safari
      document.webkitExitFullscreen();
    }
    setIsFullscreenLike(false);
    document.body.classList.remove('fullscreen-like');
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreenLike(!!document.fullscreenElement || !!document.webkitFullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  RouletteApp.propTypes = {
    player_id: PropTypes.string.isRequired,
    setMoney: PropTypes.func.isRequired,
  };

  // Function to handle chip selection
  const handleChipSelect = (value) => {
    setSelectedChip(value);
    setIsDragging(true);
  };

  // Function to handle bet placement
  const placeBet = (number) => {
    if (rolling) return;
    if (selectedChip === 0) {
      return;
    }
    // Calculate the new total amount after placing the bet
    const newTotalAmount = totalAmount + selectedChip;

    // Only allow the bet if the new total does not exceed 1000
    if (newTotalAmount <= MAXBET) {
      setBets((prevState) => {
        const currentBet = prevState[number];
        const updatedBet = currentBet + selectedChip;
        const isNumberBet = !isNaN(number) || number === "0" || number === "00";

        // Maximum bet for numbers is 100, for non-numbers is 1000
        const maxBet = isNumberBet ? 1000 : MAXBET;

        // Check if the updated bet exceeds the maximum allowed bet per type
        if (updatedBet > maxBet) {
          toast.error(`Maximum bet for numbers is ${maxBet}`);
          return prevState; // Return previous state if the new bet exceeds the limit
        }
        setTotalAmount(newTotalAmount);
        return {
          ...prevState,
          [number]: updatedBet,
        };
      });
      setActionStack((prevStack) => [...prevStack, { number, selectedChip }]);
    } else {
      toast.error(`Max total bet is ${MAXBET}`);
    }
  };

  const doubleBet = () => {
    const newBets = {};
    let totalDoubledBets = 0;

    // Calculate the doubled bets and their total
    Object.entries(bets).forEach(([key, value]) => {
      const isNumberBet = !isNaN(key) || key === "0" || key === "00";

      // Maximum bet for numbers is 100, for non-numbers is 1000
      const maxBet = isNumberBet ? 1000 : MAXBET;
      const doubledValue = value * 2;
      newBets[key] = doubledValue > maxBet ? maxBet : doubledValue;
      totalDoubledBets += newBets[key];
    });

    // Only update the bets if the total doubled bets do not exceed 1000
    if (totalDoubledBets <= 1000) {
      setBets(newBets);
      setTotalAmount(totalDoubledBets);
      setActionStack((prevStack) => [...prevStack, "double"]);
    }
    else {
      toast.error(`Max total bet is ${MAXBET}`);
    }
  };

  const undo = () => {
    if (rolling || actionStack.length === 0) return;

    const lastAction = actionStack.pop(); // Remove the last action from the stack
    if (lastAction === "double") {
      setBets((prevBets) => {
        const halvedBets = {};
        let totalHalvedAmount = 0;
        for (const [key, value] of Object.entries(prevBets)) {
          halvedBets[key] = value / 2;
          totalHalvedAmount += halvedBets[key];
        }
        setTotalAmount(totalHalvedAmount); // Update total amount after halving bets
        return halvedBets;
      });
      return;
    } else if (lastAction === "rebet") {
      setBets(betsObject);
      setTotalAmount(0); // Reset total amount as bets are reset to initial state
      return;
    } else if (lastAction === "clear") {
      setBets(beforeClear);
      setTotalAmount(Object.values(beforeClear).reduce((acc, bet) => acc + bet, 0)); // Recalculate total amount from beforeClear bets
      return;
    }

    // For undoing a regular bet
    const { number, selectedChip } = lastAction;
    setBets((prevBets) => {
      const updatedBets = {
        ...prevBets,
        [number]: prevBets[number] - selectedChip,
      };
      setTotalAmount(Object.values(updatedBets).reduce((acc, bet) => acc + bet, 0)); // Recalculate total amount after undoing the bet
      return updatedBets;
    });
  };

  // Chips values
  const chips = [1, 5, 25, 100, 500];
  const colors = [
    "text-blue-400",
    "text-red-600",
    "text-green-600",
    "text-black",
    "text-purple-500",
  ];
  // Rearrange the numbers for the desired layout
  const numbers = [];
  for (let i = 3; i > 0; i--) {
    let n = i;
    while (n <= 36) {
      numbers.push(n);
      n += 3;
    }
  }
  // Determine color for a number
  const getNumberColor = (number) => {
    const redNumbers = [
      1,
      3,
      5,
      7,
      9,
      12,
      14,
      16,
      18,
      19,
      21,
      23,
      25,
      27,
      30,
      32,
      34,
      36,
    ];
    if (redNumbers.includes(Number(number))) {
      return "bg-red-600 red-tile";
    } else {
      return "bg-gray-900 black-tile";
    }
  };
  const getHoverProperty = (number) => {
    let cssString = [];
    cssString.push(Number(number) % 2 === 0 ? "bet-even-hover" : "bet-odd-hover");
    cssString.push(
      redNumbers.includes(Number(number)) ? "bet-red-hover" : "bet-black-hover",
    );
    cssString.push(Number(number) <= 18 ? "bet-1to18-hover" : "bet-19to36-hover");
    cssString.push(
      Number(number) <= 12
        ? "bet-1to12-hover"
        : number <= 24
          ? "bet-13to24-hover"
          : "bet-25to36-hover",
    );
    cssString.push(
      Number(number) % 3 === 0
        ? "bet-firstrow-hover"
        : Number(number) % 3 === 2
          ? "bet-secondrow-hover"
          : "bet-thirdrow-hover",
    );
    return cssString.join(' '); // Default case, should not be reached for valid roulette numbers
  };

  const spinBallAndWheel = async (initialDuration) => {
    // if (JSON.stringify(bets) === JSON.stringify(betsObject)) {
    //   alert("Please place a bet");
    //   return;
    // }
    if (totalAmount > getActiveBalance()) {
      toast.error("Insufficient balance. Bet cannot be higher than balance.");
      bankPinSound.play();
      setGameStarted(false);
      setShake(true);
      setTimeout(() => {
        setShake(false);
      }, 200);
      return;
    }
    setRolling(true);
    setActionStack([]);
    setBeforeClear(betsObject);

    const loopStart = 1.5; // Start time for the loop in seconds
    const loopEnd = 3.60; // End time for the loop in seconds
    const initialPlayEnd = 1.5; // End time for the initial play in seconds

    audio.current.currentTime = 0;
    audio.current.volume = mutedStates['roulette'] ? 0 : volumes['roulette'];
    audio.current.play();

    // Play the first second of the audio
    const initialPlayTimeout = setTimeout(() => {
      audio.current.currentTime = loopStart;
    }, initialPlayEnd * 1000);
    setInitialPlayId(initialPlayTimeout);

    // Loop seconds 1-3 while the ball is spinning
    const loopInterval = setInterval(() => {
      if (audio.current.currentTime >= loopEnd) {
        audio.current.currentTime = loopStart;
      }
    }, 100);
    setIntervalId(loopInterval);
    let result;
    if (!gameFetched) {
      const { data, error } = await supabase.rpc("play_roulette", {
        v_user_id: session?.user.id,
        v_bets: bets,
        v_type: balanceType,
      });
      if (error) {
        console.error(error);
        clearInterval(loopInterval);
        clearTimeout(initialPlayTimeout);
        return;
      }
      await fetchBalances();
      result = data[0].number;
      setTarget(result);
      setWinnings(data[0].winnings);
      setGame_id(data[0].id);
    } else {
      result = currentBall;
    }
    setIsDragging(false);
    setSelectedChip(0);
    setGameOver(false);
    setGameStarted(true);
    setWinningBets([]);

    const staticball = document.getElementById(`ball${currentBall}`);
    const targetBall = document.getElementById(`ball${result}`);
    setCurrentBall(result); // Update the current ball
    staticball.style.opacity = 0; // Hide the static ball
    const ball = document.getElementById("spinny-ball");
    ball.style.display = "block"; // Make the ball visible

    let startSpeed = 0.5; // Initial speed of the ball in degrees per millisecond
    const finalSpeed = 0.05; // Final speed of the ball to match the wheel's speed

    let startTime = performance.now();
    let finalAngle;
    let finalAngleSet = false;
    let slowdownConstant = (Math.random() + 1) * speedRef.current;

    function animate(now) {
      let elapsedTime = now - startTime;
      let angle;

      // Initial slowdown phase
      const progress = elapsedTime / initialDuration > 1
        ? 1
        : elapsedTime / initialDuration;
      let newSpeed = startSpeed * (1 - progress * slowdownConstant) +
        finalSpeed * progress;
      let speed = newSpeed > 0.05 ? newSpeed : 0.05; // Linearly interpolate speed
      if (speed === 0.05 && !finalAngleSet) {
        angle = ((startSpeed - speed) / 2) * elapsedTime + speed * elapsedTime;
        finalAngle = angle;
        finalAngleSet = true;
      }
      if (speed > 0.05) {
        angle = ((startSpeed - speed) / 2) * elapsedTime + speed * elapsedTime;
      } else {
        angle = finalAngle + 0.5;
        finalAngle = angle;
      }
      if ((doPositionsAlign(ball, targetBall) && speed < 0.07 && !gameUnmounted.current) || elapsedTime > 15000) {
        const stopLoopAndPlayRest = () => {
          clearInterval(loopInterval);
          clearTimeout(initialPlayTimeout);
          audio.current.currentTime = loopEnd;
          audio.current.volume = mutedStates['roulette'] ? 0 : volumes['roulette'];
          audio.current.play();
        };
        stopLoopAndPlayRest();
        ball.style.display = "none"; // Stop animation by hiding the spinny ball
        targetBall.style.opacity = 1;
        setGameOver(true);
        findWinningsBets(result);
        setLastBet(bets);
        if (isFullscreenLike) {
          setTimeout(() => {
            setRolling(false);
          }, 2000);
        }
        setTimeout(() => {
          setBets(betsObject);
          setTotalAmount(0);
          setWinningBets([]);
          setRolling(false);
          setGameOver(false);
          audio.current.pause();
        }, 5000);
        return;
      }

      let orbitRadius = 120 + newSpeed * 140 < 120 ? 120 : 120 + newSpeed * 140;
      if (isFullscreenLike) orbitRadius *= 0.5;
      ball.style.transform =
        `rotate(${angle}deg) translate(${orbitRadius}px) rotate(-${angle}deg)`;
      if (!gameUnmounted.current) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }

  function doPositionsAlign(element1, element2) {
    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();

    // Define a threshold for how close the elements need to be to consider them "aligned"
    const threshold = 10; // pixels

    // Check if the horizontal and vertical distances are within the threshold
    const isAlignedHorizontally = Math.abs(rect1.left - rect2.left) < threshold;
    const isAlignedVertically = Math.abs(rect1.top - rect2.top) < threshold;

    return isAlignedHorizontally && isAlignedVertically;
  }

  const findWinningsBets = (winningNumber) => {
    const newWinningBets = [];
    newWinningBets.push(winningNumber);
    if (winningNumber !== "00" && winningNumber !== "0") {
      newWinningBets.push(Number(winningNumber) % 2 === 0 ? "even" : "odd");
      newWinningBets.push(
        redNumbers.includes(Number(winningNumber)) ? "red" : "black",
      );
      newWinningBets.push(Number(winningNumber) <= 18 ? "1to18" : "19to36");
      newWinningBets.push(
        Number(winningNumber) <= 12
          ? "1to12"
          : winningNumber <= 24
            ? "13to24"
            : "25to36",
      );
      newWinningBets.push(
        Number(winningNumber) % 3 === 0
          ? "firstrow"
          : Number(winningNumber) % 3 === 2
            ? "secondrow"
            : "thirdrow",
      );
    }
    setWinningBets(newWinningBets);
  };

  useEffect(() => {
    const fetchActiveGame = async () => {
      const { data, error } = await supabase.rpc('roulette_fetch_active', {
        v_user_id: session?.user.id,
      });

      if (error) {
        console.error('Error fetching active game:', error);
        return;
      }

      if (data) {
        setGameFetched(true);
        const activeGame = data;
        setGame_id(activeGame.id);
        changeBalanceType(activeGame.type);
        setBets(activeGame.bets);
        setCurrentBall(activeGame.current_number);
        setTarget(activeGame.current_number);
        setWinnings(activeGame.winnings);
        setGameStarted(true);
        await fetchBalances();
      }
    };
    if (session?.user.id.length > 0) {
      fetchActiveGame();
    }
  }, [session?.user.id]);
  useEffect(() => {
    if (gameFetched) {
      spinBallAndWheel(15000);
    }
  }, [gameFetched]);
  useEffect(() => {
    const EndRouletteGame = async () => {
      const { data, error } = await supabase.rpc("end_roulette", {
        game_id: game_id,
        v_user_id: session?.user.id,
      });
      if (error) {
        console.error(error);
        return;
      }
      setGameFetched(false);
      await fetchBalances();
    }
    if (gameOver) {
      EndRouletteGame();
    }
  }, [gameOver]);

  useEffect(() => {
    setDisableModifications(rolling);
  }, [rolling])
  useEffect(() => {
    return () => {
      setDisableModifications(false);
      audio.current.volume = 0;
      audio.current.currentTime = 0;
      audio.current = new Audio(spinSound);
      gameUnmounted.current = true;
    }
  }, [audio.current])
  useEffect(() => {
    return () => {
      clearInterval(intervalId);
    }
  }, [intervalId]);
  useEffect(() => {
    return () => {
      clearTimeout(initialPlayId);
    }
  }, [initialPlayId])
  useEffect(() => {
    setActiveGame('roulette');
  }, [])

  const LandscapePrompt = () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="text-white text-center">
        <p className="text-2xl mb-4">Please rotate your device to landscape mode</p>
        <IoIosPhoneLandscape className="text-4xl mx-auto" />
      </div>
    </div>
  );

  const FullscreenPrompt = ({ toggleFullscreenLike }) => (
    <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <button
        onClick={toggleFullscreenLike}
        className="px-6 py-3 bg-primary-500 text-white rounded-lg shadow-lg text-xl font-bold animate-pulse hover:bg-primary-600 transition-colors duration-300"
      >
        Enter Fullscreen
      </button>
    </div>
  );

  return (
    <>
      <div ref={containerRef} className={`game-container min-h-[100%] min-w-[100%] p-12 h-screen flex flex-col items-center justify-center overflow-hidden mb-10 ${isFullscreenLike ? 'fullscreen-like' : ''}`}>
        {/* Mobile-only prompts */}
        <div className="mobile-portrait">
          <LandscapePrompt />
        </div>
        <div className="mobile-landscape">
          {!isFullscreenLike && <FullscreenPrompt toggleFullscreenLike={toggleFullscreenLike} />}
        </div>

        {isFullscreenLike && (
          <>
            <div className="absolute top-50 left-4 z-50 bg-primary-900 p-2 rounded-md shadow-lg">
              <span className="text-lg font-semibold">{getActiveBalance()} {balanceType === "gold" ? <GoldCoin style={{ width: '20px', height: '20px' }} /> : <SilverCoin style={{ width: '20px', height: '20px' }} />}</span>
            </div>
            <button
              onClick={exitFullscreenLike}
              className="absolute top-4 right-4 z-50 bg-primary-900 p-2 rounded-md shadow-lg text-white hover:bg-primary-700 transition-colors duration-300"
              aria-label="Exit Fullscreen"
            >
              <RiFullscreenExitLine size={24} />
            </button>
          </>
        )}

        {isDragging && (
          <DraggableChip
            selectedChip={selectedChip}
            colors={colors}
            index={chips.indexOf(selectedChip)}
          />
        )}
        <div id="board" className="relative flex flex-row items-center justify-center">
          {!isFullscreenLike ? (
            <div id="wheel" className="mr-8 hidden lg:flex items-center justify-center animate-spin-slow">
              <img
                src="/wheel7.png"
                alt="Roulette Wheel"
                className="flex items-center justify-center select-none"
                style={{ transformOrigin: "50% 50%" }}
              />
              <div id="spinny-ball" className="hidden absolute w-4 h-4 bg-white rounded-full -translate-y-[90px] -translate-x-[70px]" />
              <Balls />
            </div>
          ) : (
            <>
              <div className={`${rolling ? "block" : "hidden"} fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 lg:hidden`}>
                <div id="wheel" className="flex items-center justify-center animate-spin-slow scale-50">
                  <img
                    src="/wheel7.png"
                    alt="Roulette Wheel"
                    className="flex items-center justify-center select-none scale-50"
                    style={{ transformOrigin: "50% 50%" }}
                  />
                  <div id="spinny-ball" className="hidden absolute w-2 h-2 bg-white rounded-full -translate-y-[45px] -translate-x-[35px]" />
                  <MobileBalls />
                </div>
              </div>
            </>
          )}
          <div>
            <div id="numbersandrowbets" className="flex flex-col mt-3">
              <div id="numbers" className="relative flex">
                <div id="zeros" className="flex flex-col items-center ml-1 justify-between h-full">
                  <button
                    key={0}
                    className={`relative min-w-[30px] min-h-[22.5px] md:min-w-[39px] md:min-h-[67.5px] flex items-center justify-center text-white font-bold cursor-pointer
  ${winningBets.includes("0") ? "gold-tile" : "bg-green-600 green-tile"} aspect-square border border-neutral-300 select-none`}
                    onClick={() => placeBet(0)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        placeBet(0);
                      }
                    }}
                  >
                    0
                    {bets[0] > 0 && (
                      <GeneralChip amount={bets[0]} />
                    )}
                  </button>
                  <button
                    key={"00"}
                    className={`relative min-w-[30px] min-h-[22.5px] md:min-w-[39px] md:min-h-[67.5px] flex items-center justify-center text-white font-bold cursor-pointer
  ${winningBets.includes("00") ? "gold-tile" : "bg-green-600 green-tile"} aspect-square border border-neutral-300 select-none`}
                    onClick={() => placeBet("00")}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        placeBet("00");
                      }
                    }}
                  >
                    00
                    {bets["00"] > 0 && (
                      <GeneralChip amount={bets["00"]} />
                    )}
                  </button>
                </div>
                <div id="numbers" className="relative flex flex-col">
                  <div id="greaterthanzero" className="grid grid-cols-12 min-w-[347px]">
                    {numbers.map((number) => (
                      <button
                        key={number}
                        className={`${getHoverProperty(number)} relative md:min-w-[45px] md:min-h-[33.75px] flex items-center justify-center text-white font-bold cursor-pointer 
  ${winningBets.includes(number.toString()) ? "gold-tile" : `${getNumberColor(number)}`} aspect-square border border-neutral-300 select-none ${getHoverProperty(number)}`}
                        onClick={() => placeBet(number.toString())}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            placeBet(number.toString());
                          }
                        }}
                      >
                        {number}
                        {bets[number] > 0 && (
                          <GeneralChip amount={bets[number]} />
                        )}
                      </button>
                    ))}
                  </div>
                  <div id="nonnumbers" className="flex w-full justify-between">
                    <Twelvebets
                      bets={bets}
                      placeBet={placeBet}
                      winningBets={winningBets}
                    />
                  </div>
                </div>
                <div id="rowbets" className="flex flex-col mr-1">
                  <Rowbet
                    id="firstrow"
                    text="2:1"
                    bets={bets}
                    placeBet={placeBet}
                    additionalStyles={`${winningBets.includes("firstrow") ? "gold-tile" : `grey-tile`}`}
                  />
                  <Rowbet
                    id="secondrow"
                    text="2:1"
                    bets={bets}
                    placeBet={placeBet}
                    additionalStyles={`${winningBets.includes("secondrow") ? "gold-tile" : `grey-tile`}`}
                  />
                  <Rowbet
                    id="thirdrow"
                    text="2:1"
                    bets={bets}
                    placeBet={placeBet}
                    additionalStyles={`${winningBets.includes("thirdrow") ? "gold-tile" : `grey-tile`}`}
                  />
                </div>
                {gameOver && (
                  <FadedInWinningsComponent
                    winnings={winnings}
                    push={false}
                    gameOver={gameOver}
                    shouldPlaySound={true}
                  />
                )}
              </div>
            </div>
            <div id="actions&chips" className="flex items-center justify-between mt-2">
              <div className="flex mr-2">
                <ActionButton
                  name="Undo"
                  action={() => {
                    if (rolling) return;
                    undo();
                  }}
                  Icon={GrUndo}
                  shouldntDisable={true}
                  disable={rolling}
                  additionalStyles="mr-1"
                  additionalButtonStyles="m-1 mr-0 lg:m-4 mb-1 lg:mb-2"
                />
                <ActionButton
                  name="Clear"
                  action={() => {
                    if (rolling) return;
                    if (actionStack[actionStack.length - 1] !== "clear") {
                      setActionStack((prevStack) => [...prevStack, "clear"]);
                      setBeforeClear(bets);
                    }
                    setBets(betsObject);
                    setTotalAmount(0);
                    setIsDragging(false);
                    setSelectedChip(0);
                  }}
                  Icon={FaTrash}
                  disable={rolling}
                  additionalStyles="ml-1"
                  additionalButtonStyles="m-1 mr-0 lg:m-4 mb-1 lg:mb-2"
                />
              </div>
              <div className="flex flex-col items-center">
                <div className={`flex space-x-4 mb-2 border-4 border-neutral-300 p-2 mt-3`} style={{
                  backgroundImage: balanceType === "gold"
                    ? "radial-gradient(circle at top, #c5a500, #b79500 40%, #a67c00 80%, #c5a500)"
                    : "radial-gradient(circle at top, #C0C0C0, #A9A9A9 40%, #808080 80%, #C0C0C0)"
                }}>
                  {chips.map((chip, index) => (
                    <button
                      key={chip + index}
                      className="relative"
                      onClick={() => {
                        handleChipSelect(chips[index]);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleChipSelect(chips[index]);
                        }
                      }}
                    >
                      <div
                        className={`flex align-center justify-center w-9 lg:w-12 h-9 lg:h-12 rounded-full bg-gray-300 relative cursor-pointer ${chips[index] === selectedChip ? "selected-chip" : ""}`}
                      >
                        <PiPokerChipFill
                          className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-5xl lg:text-6xl ${colors[index]}`}
                        />
                      </div>
                      <p className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white font-bold z-10 text-sm select-none cursor-pointer">
                        {chips[index]}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="flex justify-center space-x-4 mt-2">
                  <VolumeControl gameId="roulette" disableModification={rolling} />
                  <SpeedControl gameId="roulette" disableModification={rolling} speed={speed} setSpeed={setSpeed} />
                </div>
              </div>

              <div className="flex ml-2">
                {(JSON.stringify(lastBet) !== JSON.stringify(betsObject) &&
                  JSON.stringify(bets) === JSON.stringify(betsObject)) ? (
                  <ActionButton
                    name="Rebet"
                    action={() => {
                      if (rolling) return;
                      setBets(lastBet);
                      const totalRebetAmount = Object.values(lastBet).reduce((acc, bet) => acc + bet, 0); // Calculate the total amount of the last bets
                      setTotalAmount(totalRebetAmount); // Update the total amount to reflect the rebet amount
                      setActionStack((prevStack) => [...prevStack, "rebet"]);
                    }}
                    Icon={VscDebugRestart}
                    disable={rolling}
                    additionalStyles="mr-1"
                  />
                ) : (
                  <ActionButton
                    name="x2"
                    action={() => {
                      if (rolling) return;
                      doubleBet();
                    }}
                    Icon={PiCoinsFill}
                    disable={JSON.stringify(bets) === JSON.stringify(betsObject) ||
                      rolling}
                    additionalStyles="ml-1"
                  />
                )}
                <ActionButton
                  name="Spin"
                  action={() => {
                    if (rolling) return;
                    spinBallAndWheel(15000);
                  }}
                  Icon={FaSpinner}
                  disable={rolling ||
                    JSON.stringify(bets) === JSON.stringify(betsObject) ||
                    !signedIn}
                  additionalStyles={`mr-1 ${shake ? 'shake-animation' : ''}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <RulesComponent rules={rouletteRules} />
    </>
  );
};

export default RouletteApp;

