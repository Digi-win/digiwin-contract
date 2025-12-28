
import { Cl, ClarityType, cvToString, cvToValue } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;

describe("DigiWin Game Functions", () => {
  it("allows creating a new game", () => {
    const min = 1;
    const max = 100;
    const fee = 100000;

    const response = simnet.callPublicFn(
      "digiwin",
      "create-game",
      [Cl.uint(min), Cl.uint(max), Cl.uint(fee)],
      deployer
    );

    expect(response.result).toBeOk(Cl.uint(0));
  });

  it("fails to create game with invalid range (min > max)", () => {
    const min = 100;
    const max = 10;
    const fee = 100000;

    const response = simnet.callPublicFn(
      "digiwin",
      "create-game",
      [Cl.uint(min), Cl.uint(max), Cl.uint(fee)],
      deployer
    );

    expect(response.result).toBeErr(Cl.uint(105)); // ERR_INVALID_PARAMS
  });

  // NEW TEST 1
  it("fails to create game with min equal to max", () => {
    // min == max should trigger ERR_INVALID_PARAMS (u105)
    const createResponse = simnet.callPublicFn(
        "digiwin", 
        "create-game", 
        [Cl.uint(100), Cl.uint(100), Cl.uint(100000)], 
        deployer
    );
    expect(createResponse.result).toBeErr(Cl.uint(105)); 
  });

  // NEW TEST 2
  it("fails to guess number out of range", () => {
    // Create a specific game for this test to be isolated
    const createResponse = simnet.callPublicFn(
        "digiwin", 
        "create-game", 
        [Cl.uint(10), Cl.uint(20), Cl.uint(50)], 
        deployer
    );
    // Get the ID (unwrap OK result)
    const gameId = (createResponse.result as any).value;

    // Guess 21 (max is 20)
    const response = simnet.callPublicFn(
        "digiwin", 
        "guess", 
        [gameId, Cl.uint(21)], 
        wallet1
    );
    expect(response.result).toBeErr(Cl.uint(103)); // ERR_INVALID_GUESS
  });

  it("allows guessing and collects fees", () => {
      // Create new game
      const create = simnet.callPublicFn(
          "digiwin",
          "create-game",
          [Cl.uint(1), Cl.uint(100), Cl.uint(1000)],
          deployer
      );
      const gameId = (create.result as any).value;

      const guessResponse = simnet.callPublicFn(
          "digiwin",
          "guess",
          [gameId, Cl.uint(50)], 
          wallet1
      );

      expect(guessResponse.result.type).toBe(ClarityType.ResponseOk);
      
      const pool = simnet.callReadOnlyFn("digiwin", "get-prize-pool", [gameId], deployer);
      expect(pool.result).toBeSome(Cl.uint(1000));
  });

  // NEW TEST 3
  it("fails to guess on already won game", () => {
    // Create a game with range 2 (e.g. 1-2) to ensure we can win it easily
    const createRes = simnet.callPublicFn(
        "digiwin", 
        "create-game", 
        [Cl.uint(1), Cl.uint(2), Cl.uint(10)], 
        deployer
    );
    const gameId = (createRes.result as any).value;
    
    // Try guessing 1 and 2. One MUST match the secret.
    let guessRes = simnet.callPublicFn("digiwin", "guess", [gameId, Cl.uint(1)], deployer);
    
    // If we didn't win with 1, guess 2
    if (guessRes.result.type !== ClarityType.ResponseOk || (guessRes.result as any).value.type === ClarityType.BoolFalse) {
         guessRes = simnet.callPublicFn("digiwin", "guess", [gameId, Cl.uint(2)], deployer);
    }
    
    // Now the game MUST be won.
    // Verify status is "won"
    const gameInfo = simnet.callReadOnlyFn("digiwin", "get-game-info", [gameId], deployer);
    const infoString = cvToString(gameInfo.result);
    expect(infoString).toContain('(status "won")');

    // Try guessing again on the won game
    const guessAgain = simnet.callPublicFn("digiwin", "guess", [gameId, Cl.uint(1)], deployer);
    expect(guessAgain.result).toBeErr(Cl.uint(102)); // ERR_GAME_ALREADY_WON
  });

  it("prevents guessing on non-existent game", () => {
      const response = simnet.callPublicFn(
          "digiwin",
          "guess",
          [Cl.uint(9999), Cl.uint(50)],
          wallet1
      );
      expect(response.result).toBeErr(Cl.uint(101)); // ERR_GAME_NOT_FOUND
  });

});
