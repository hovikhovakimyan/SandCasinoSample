import { supabase } from "../../api/supabaseClient.js";
import React, { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext.js";
import { useBalance } from "../../contexts/BalanceContext.js";
import { Hand } from "../../objects/Ihand.js";
import { Insurance } from "../../objects/insurance.js";
import CardComponent from "./CardComponent";
import ActionButton from "./ActionButtons";
import HandComponent from "./HandComponent";
import WinningsComponent from "./WinningsComponent";
import withFadeInDelay from "../withFadeInDelay";
import GeneralBettingWindow from "../GeneralBettingWindow";
import PayoutDisplay from '../Ultimate-Texas/PayoutDisplay';
import { preloadCardImages } from "../../utils/cardUtils.js";
import RulesComponent from '../../components/RulesComponent';
import { blackjackRules } from '../../components/gameRules';
import { useBet } from '../../hooks/useBet';


import {
  BsFilePlusFill,
  BsFillSuitSpadeFill,
  BsShieldFillPlus,
} from "react-icons/bs";
import { AiOutlineCheck, AiOutlineLoading3Quarters } from "react-icons/ai";
import { ImCancelCircle } from "react-icons/im";
import { IoIosHand } from "react-icons/io";
import { PiCoinsFill, PiSplitHorizontal } from "react-icons/pi";
import { VscDebugRestart } from "react-icons/vsc";
import SidebetsDisplay from "./SidebetsDisplay";
import bankpinfail from '../../assets/bankpinfail.mp3';
import { toast } from "react-toastify";
import { useVolume } from "../../contexts/VolumeContext";
import confetti from 'canvas-confetti';

const DealerHandTitle: React.FC = () => {
  return (
    <h1 className="hidden md:block text-white font-bold text-3xl mb-4 cursor-default pointer-events-none select-none">
      Dealer Hand
    </h1>
  );
};
const FadedInDealerHandTitle = withFadeInDelay(DealerHandTitle);
const FadedInWinningsComponent = withFadeInDelay(WinningsComponent, 500);

export default function NewBlackjack() {
  const {
    bet,
    setBet,
    handleBetChange: handleMainBetChange,
    handleBetBlur: handleMainBetBlur,
    handleHalfBet: handleMainHalfBet,
    handleDoubleBet: handleMainDoubleBet,
  } = useBet(0);

  const {
    bet: twentyOnePlusThreeBet,
    setBet: setTwentyOnePlusThreeBet,
    handleBetChange: handleTwentyOnePlusThreeBetChange,
    handleBetBlur: handleTwentyOnePlusThreeBetBlur,
    handleHalfBet: handleTwentyOnePlusThreeHalfBet,
    handleDoubleBet: handleTwentyOnePlusThreeDoubleBet,
  } = useBet(0);

  const {
    bet: perfectPairsBet,
    setBet: setPerfectPairsBet,
    handleBetChange: handlePerfectPairsBetChange,
    handleBetBlur: handlePerfectPairsBetBlur,
    handleHalfBet: handlePerfectPairsHalfBet,
    handleDoubleBet: handlePerfectPairsDoubleBet,
  } = useBet(0);

  const [game_id, setGameId] = useState<number>(0);
  const [playerHands, setPlayerHands] = useState<Hand[]>([]);
  const [dealerHand, setDealerHand] = useState<Hand>({} as Hand);
  const [loading, setLoading] = useState<boolean>(true);
  const [active_hand_index, setActiveHandIndex] = useState<number>(1);
  const [twentyOnePlusThreeWinnings, setTwentyOnePlusThreeWinnings] = useState<number>(0);
  const [perfectPairsWinnings, setPerfectPairsWinnings] = useState<number>(0);
  const [game_started, setGameStarted] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [gameFetched, setGameFetched] = useState<boolean>(false);
  const [dealersTurn, setDealersTurn] = useState<boolean>(false); //used to determine if dealer is playing or not
  const [insuranceState, setInsuranceState] = useState<Insurance>(
    {} as Insurance
  );
  const [splitting, setSplitting] = useState<boolean>(false);
  const [firstGame, setFirstGame] = useState<boolean>(true);
  const [isBlackjack, setIsBlackjack] = useState<boolean>(false);
  const [isDealerBlackjack, setIsDealerBlackjack] = useState<boolean>(false);
  const [totalWinnings, setTotalWinnings] = useState(0);
  const [totalBet, setTotalBet] = useState(0);
  const [winState, setWinState] = useState("");

  const [cardImages, setCardImages] = useState({});
  const [imagesLoaded, setImagesLoaded] = useState(false);

  const [shake, setShake] = useState(false);
  const [speed, setSpeed] = useState(1);
  const bankPinSound = new Audio(bankpinfail);

  const { session, signedIn } = useAuth();
  const { MAXBET, balanceType, changeBalanceType, fetchBalances, getActiveBalance, setDisableModifications } = useBalance();
  const { setActiveGame } = useVolume();

  async function restartGame() {
    setPlayerHands([]);
    setDealerHand({} as Hand);
    setActiveHandIndex(1);
    setGameId(0);
    setTwentyOnePlusThreeWinnings(0);
    setPerfectPairsWinnings(0);
    setTotalWinnings(0);
    setWinState("");
    setTotalBet(0);
    setIsBlackjack(false);
    setIsDealerBlackjack(false);
    setGameOver(false);
    setDealersTurn(false);
    setLoading(true);
    confetti.reset();
  }

  async function createAndFetchGame() {
    if (bet + twentyOnePlusThreeBet + perfectPairsBet > getActiveBalance()) {
      toast.error("Insufficient balance. Bet cannot be higher than balance.");
      bankPinSound.play();
      setGameStarted(false);
      setShake(true);
      setTimeout(() => {
        setShake(false);
      }, 200);
      return;
    }
    const { data, error } = await supabase.rpc("start_game", {
      v_player_id: session?.user.id,
      bet: bet,
      v_twentyoneplusthreebet: twentyOnePlusThreeBet,
      v_perfectpairsbet: perfectPairsBet,
      v_type: balanceType,
    });
    if (error) {
      setGameStarted(false);
      toast.error(error.message);
      bankPinSound.play();
      setShake(true);
      setTimeout(() => {
        setShake(false);
      }, 200);
      console.error("Error creating game:", error);
      return null;
    }

    return data;
  }

  async function endGame() {
    //setGameOver(true);
    let { data, error } = await supabase.rpc("end_game", {
      game_id: game_id,
      v_player_id: session?.user.id,
    });
    if (error) {
      console.error("Error ending blackjack game:", error);
      return null;
    }
    let updatedPlayerHands: Hand[] = data.hands;
    setPlayerHands(updatedPlayerHands);
    setWinState(updatedPlayerHands[0].winstate);
    setTotalWinnings(data.total_winnings); // Assuming you have a state or a way to track total winnings
  }

  async function hit() {
    let { data, error } = await supabase.rpc("hitblackjackhand", {
      game_id: game_id,
      v_player_id: session?.user.id,
    });
    if (error) {
      console.error("Error hitting blackjack hand:", error);
      return null;
    }
    let newHand: Hand = data;
    const updatedPlayerHands = playerHands.map(
      (hand, index) => (index === active_hand_index - 1 ? newHand : hand) //remember to change to active_hand-1
    );

    setPlayerHands(updatedPlayerHands);
    if (newHand.busted || newHand.count === 21) {
      stand();
    }
  }
  async function double() {
    let { data, error } = await supabase.rpc("double", {
      game_id: game_id,
      v_player_id: session?.user.id,
    });
    if (error) {
      console.error("Error doubling blackjack hand:", error);
      toast.error(error.message);
      return null;
    }
    let newHand: Hand = data;
    const updatedPlayerHands = playerHands.map(
      (hand, index) => (index === active_hand_index - 1 ? newHand : hand) //remember to change to active_hand-1
    );
    await fetchBalances();
    setTotalBet(prev => prev + bet);
    setPlayerHands(updatedPlayerHands);
    stand();
  }
  async function stand() {
    let { data, error } = await supabase.rpc("stand", {
      game_id: game_id,
      v_player_id: session?.user.id,
    });
    if (error) {
      console.error("Error with dealer play:", error);
      return null;
    }
    if (!data.dealer_hand) {
      setSplitting(true);
      setTimeout(() => {
        setActiveHandIndex(data.active_hand_index);
        setTimeout(() => {
          setSplitting(false);
        }, 500);
      }, 1500);
      return;
    }
    let newHand: Hand = data.dealer_hand;
    setTimeout(() => {
      setDealersTurn(true);
    }, 750);
    setTimeout(() => {
      setDealerHand(newHand);
    }, 750);
    endGame();
  }
  async function split() {
    setSplitting(true);
    let { data, error } = await supabase.rpc("splithand", {
      game_id: game_id,
      v_player_id: session?.user.id,
    });
    if (error) {
      console.error("Error splitting blackjack hand:", error);
      return null;
    }
    await fetchBalances();
    setTotalBet(prev => prev + bet);
    setPlayerHands(data);
    setTimeout(() => {
      setSplitting(false);
    }, 500);
  }
  async function insurance(choice: boolean) {
    const newInsuranceState: Insurance = {
      canoffer: true,
      offered: true,
      accepted: choice,
    };
    setInsuranceState(newInsuranceState);
    let { data, error } = await supabase.rpc("insurance", {
      game_id: game_id,
      accepted: choice,
      v_player_id: session?.user.id,
    });
    if (error) {
      console.error("Error with insurance:", error);
      return null;
    }
    if (choice === true) {
      setTotalBet(prev => prev + bet);
      await fetchBalances();
    }
    let newDealerHand: Hand = data;
    if (newDealerHand.blackjack) {
      setIsDealerBlackjack(true);
      stand();
    } else if (isBlackjack) {
      stand();
    }
  }

  useEffect(() => {
    const startGame = async () => {
      const newGameState = await createAndFetchGame();
      if (game_id !== 0 && newGameState) {
        await restartGame();
      }
      if (newGameState) {
        setSplitting(true);
        setTotalBet(bet);
        let isBlackjack = newGameState.player_hands[0].blackjack;
        setGameId(newGameState.game_id);
        setDealerHand(newGameState.dealer_hand);
        setPlayerHands(newGameState.player_hands);
        setInsuranceState(newGameState.insurance_status);
        setTwentyOnePlusThreeWinnings(newGameState.twentyoneplusthreewinnings);
        setPerfectPairsWinnings(newGameState.perfectpairswinnings);
        let { data, error } = await supabase.rpc("checkandupdateforsplit", {
          game_id: newGameState.game_id,
          v_player_id: session?.user.id,
        });
        if (error) {
          console.error("Error checking split:", error);
          return null;
        }
        await fetchBalances();
        if (cardImages) {
          setCardImages(cardImages);
        }

        setPlayerHands(data);
        setLoading(false);
        setFirstGame(false);
        setIsBlackjack(isBlackjack);
        setTimeout(() => {
          setSplitting(false);
        }, 500);
      }
    };

    if (game_started) {
      startGame();
    }
  }, [game_started]);
  useEffect(() => {
    const handleGameOver = async () => {
      setGameStarted(false);
      await fetchBalances();
    };
    if (gameOver) {
      handleGameOver();
    }
  }, [gameOver]);

  useEffect(() => {
    const checkForDealerBlackjack = async () => {
      let { data, error } = await supabase.rpc("checkfordealerblackjack", {
        game_id: game_id,
        v_player_id: session?.user.id,
      });
      if (error) {
        console.error("Error checking for dealer blackjack:", error);
        return null;
      }
      if (data.blackjack) {
        setIsDealerBlackjack(true);
        stand();
      }
    };
    if ((game_started || gameFetched) && !insuranceState.canoffer) {
      checkForDealerBlackjack();
    }
  }, [insuranceState]);

  useEffect(() => {
    if (isBlackjack) {
      stand();
    }
  }, [isBlackjack]);
  useEffect(() => {
    setActiveGame('blackjack');
    preloadCardImages()
      .then((images) => {
        setCardImages(images);
        setImagesLoaded(true);
      })
      .catch((error) => {
        console.error("Failed to load card images:", error);
      });
  }, []);
  useEffect(() => {
    const fetchActiveGame = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('blackjack_fetch_active', {
        v_player_id: session?.user.id,
      });

      if (error) {
        console.error('Error fetching active game:', error);
        return;
      }
      if (data) {
        setSplitting(true);
        const activeGame = data;
        setGameId(activeGame.id);
        changeBalanceType(activeGame.type);
        setDealerHand(activeGame.dealer_hand);
        setInsuranceState(activeGame.insurance_status);
        setPlayerHands(activeGame.player_hands);
        setBet(activeGame.player_hands[0].bet);
        setTwentyOnePlusThreeBet(activeGame.twentyoneplusthreebet);
        setPerfectPairsBet(activeGame.perfectpairsbet);
        setPerfectPairsWinnings(activeGame.perfectpairswinnings);
        setTwentyOnePlusThreeWinnings(activeGame.twentyoneplusthreewinnings);
        setActiveHandIndex(activeGame.active_hand_index);
        setLoading(false);
        setFirstGame(false);
        setIsBlackjack(activeGame.player_hands[0].blackjack);
        setGameFetched(true);
        setTimeout(() => {
          setSplitting(false);
        }, 500);
        // Update other state variables as needed
      }
    };
    if (session?.user.id.length > 0) {
      fetchActiveGame();
    }
  }, [session?.user.id]);
  useEffect(() => {
    setDisableModifications(!gameOver && (game_started || gameFetched));
  }, [gameOver, game_started, gameFetched])
  useEffect(() => {
    return () => {
      setDisableModifications(false);
    }
  }, [])

  return (
    <>
      <div className="main-container order-reverse">
        <GeneralBettingWindow
          bets={[
            {
              name: "Amount",
              bet: bet,
              handleAmountChange: handleMainBetChange,
              handleBlur: handleMainBetBlur,
              handleHalfBet: handleMainHalfBet,
              handleDoubleBet: handleMainDoubleBet,
              valid: bet > 0,
              winnings: totalWinnings,
              winState: winState,
              push: totalWinnings === totalBet
            },
            {
              name: "21+3",
              bet: twentyOnePlusThreeBet,
              handleAmountChange: handleTwentyOnePlusThreeBetChange,
              handleBlur: handleTwentyOnePlusThreeBetBlur,
              handleHalfBet: handleTwentyOnePlusThreeHalfBet,
              handleDoubleBet: handleTwentyOnePlusThreeDoubleBet,
              valid: twentyOnePlusThreeBet >= 0,
              winnings: twentyOnePlusThreeWinnings,
              sideBet: true,
              anteInfo: totalWinnings === 0,
              winState: winState,
            },
            {
              name: "Perfect Pairs",
              bet: perfectPairsBet,
              handleAmountChange: handlePerfectPairsBetChange,
              handleBlur: handlePerfectPairsBetBlur,
              handleHalfBet: handlePerfectPairsHalfBet,
              handleDoubleBet: handlePerfectPairsDoubleBet,
              valid: perfectPairsBet >= 0,
              winnings: perfectPairsWinnings,
              sideBet: true,
              anteInfo: totalWinnings === 0 && (twentyOnePlusThreeBet > 0 && twentyOnePlusThreeWinnings === 0),
              winState: winState,
            }
          ]}
          startGame={() => setGameStarted(true)}
          gameStarted={!gameOver && (game_started || gameFetched)}
          signedIn={signedIn}
          gameOver={gameOver}
          showChips={true}
          autoPlay={false}
          shake={shake}
          balanceType={balanceType}
          gameId="blackjack"
          speed={speed}
          setSpeed={setSpeed}
        />
        {loading && (
          <div className="flex flex-grow min-w-[12.0646 rem] min-h-[95%]">
            <div
              className="game-container flex flex-grow items-center justify-center first-letter relative"
            >
              {firstGame && imagesLoaded ? (
                <div className="flex flex-col items-center justify-center">
                  <h1 className="text-3xl md:text-7xl text-white text-center animate-pulse font-bold mb-4">
                    {signedIn ? "Place Bet to Start!" : "Sign in to Play!"}
                  </h1>
                  <BsFillSuitSpadeFill className="text-6xl md:text-9xl text-white text-center animate-pulse" />
                  <SidebetsDisplay />
                </div>
              ) : (
                <>
                  <AiOutlineLoading3Quarters className="text-8xl text-white text-center animate-spin" />
                  <SidebetsDisplay />
                </>
              )}
            </div>
          </div>
        )}
        {!loading && imagesLoaded && playerHands && (
          <div
            className="game-container flex flex-grow flex-col items-center justify-center bg-primary-100 relative"
            id="game-board"
            data-testid="game-board"
          >
            <SidebetsDisplay />
            <FadedInDealerHandTitle />
            <div
              className="flex flex-col items-center justify-center align-middle relative"
              id="both-hands"
            >
              <div
                className="mb-7 md:mb-14 mt-2 flex flex-row"
                id={`dealer-hand`}
                data-testid="dealer-hand"
              >
                {dealerHand && (
                  <HandComponent
                    key="dealer"
                    name="dealer"
                    dealerHand={dealerHand}
                    onDealerFinishing={() => {
                      setGameOver(true);
                      setGameFetched(false);
                    }}
                    dealersTurn={dealersTurn}
                    cardImages={cardImages}
                    speed={speed}
                  />
                )}
              </div>
              {insuranceState.canoffer && !insuranceState.offered && (
                <div className="flex flex-col items-center justify-center align-middle relative lg:absolute lg:-translate-y-1/4 bg-[#257381] z-10 p-3 rounded-xl shadow-xl shadow-black">
                  <h1 className="text-xl md:text-4xl text-white text-center select-none font-bold md:tracking-widest md:pl-8 md:pr-8">
                    INSURANCE
                  </h1>
                  {/* <h2 className="hidden md:block text-lg text-white text-center font-roboto"> Tap one of the buttons </h2> */}
                  <h2 className="text-xl text-white text-center font-roboto pt-1">
                    {" "}
                    PAYS 2 TO 1{" "}
                  </h2>
                  {/* <div className="w-10 md:w-20 h-10 md:h-20 flex items-center justify-center border-4 rounded-full m-2 bg-bovada hover:shadow-lg">
                  <BsShieldFillPlus className="text-xl md:text-5xl text-white text-center" />
                </div> */}
                  <div className="flex items-center justify-center align-middle pt-3">
                    <button
                      className="w-7 md:w-12 h-7 md:h-12 rounded-lg hover:bg-green-500 flex items-center justify-center mr-3 border-white border-2 hover:shadow-black hover:shadow-md"
                      onClick={() => {
                        insurance(true);
                      }}
                    >
                      <AiOutlineCheck className="text-xl md:text-4xl font-bold text-center text-white hover:text-5xl" />
                    </button>
                    <button
                      className="w-7 md:w-12 h-7 md:h-12 rounded-lg text-white hover:bg-red-500 flex items-center justify-center ml-3 border-white border-2 hover:shadow-black hover:shadow-md"
                      onClick={() => {
                        insurance(false);
                      }}
                    >
                      <ImCancelCircle className="text-xl md:text-4xl text-center hover:text-5xl" />
                    </button>
                  </div>
                </div>
              )}
              <div

                style={{ paddingBottom: '20px' }}
                className="mt-7 md:mt-14 flex flex-row relative"
                id="player-hands"
                data-testid="player-hand"
              >
                {playerHands && (
                  <HandComponent
                    data-testid="player-hand"
                    key="player"
                    name="player"
                    hand={playerHands[active_hand_index - 1]}
                    active_hand_index={active_hand_index}
                    handsLength={playerHands.length}
                    cardImages={cardImages}
                    soft={playerHands[active_hand_index - 1].soft}
                    speed={speed}
                  />
                )}
                {gameOver && (
                  <>
                    <FadedInWinningsComponent
                      gameOver={gameOver}
                      playerHand={playerHands[active_hand_index - 1]}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '-30%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 10
                    }}>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-center" id="action-buttons">
              {(!insuranceState.canoffer || insuranceState.offered) &&
                !dealersTurn &&
                !splitting && !isBlackjack && !isDealerBlackjack && !gameOver ? (
                <>
                  <ActionButton name="Hit" action={hit} Icon={BsFilePlusFill} />
                  <ActionButton name="Stand" action={stand} Icon={IoIosHand} additionalIconStyles="text-2xl lg:text-5xl mr-1" />
                  {playerHands[active_hand_index - 1].cards.length === 2 && (
                    <ActionButton
                      name="Double"
                      action={double}
                      Icon={PiCoinsFill}
                    />
                  )}
                  {playerHands[active_hand_index - 1].cansplit &&
                    playerHands[active_hand_index - 1].cards.length === 2 &&
                    playerHands.length < 4 && (
                      <ActionButton
                        name="Split"
                        action={split}
                        Icon={PiSplitHorizontal}
                      />
                    )}
                </>
              ) : gameOver ? (
                <div className="min-w-[264px] min-h-[68px] lg:min-h-[112px] flex items-center justify-center">
                  <button
                    className="play-again-button"
                    onClick={() => setGameStarted(true)}
                  >
                    <VscDebugRestart className="mr-2" />
                    Play Again
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[68px] md:h-[112px]" />
              )}
            </div>
            <div
              className="flex flex-row items-center justify-center mb-3"
              id="inactive-hands"
            >
              {playerHands
                .filter((hand, index) => index !== active_hand_index - 1)
                .map((hand, index1) => {
                  return (
                    <div
                      className="flex flex-row relative mt-6"
                      id="player-hands"
                    >
                      <div className="flex w-full items-center justify-evenly ml-6 mr-6">
                        {hand.cards.map((card, index2) => (
                          <>
                            {!(
                              hand.cards.length === 2 &&
                              index2 === 1 &&
                              index1 + 1 > active_hand_index - 1
                            ) && (
                                <CardComponent
                                  card={card}
                                  lastCard={index2 === hand.cards.length - 1}
                                  count={hand.count}
                                  active={false}
                                  key={Math.random() + index2}
                                />
                              )}
                          </>
                        ))}
                      </div>
                      {gameOver && (
                        <FadedInWinningsComponent
                          gameOver={gameOver}
                          playerHand={hand}
                        />
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
      <RulesComponent rules={blackjackRules} />
    </>
  );
}
