import { chromium, type Page } from "playwright";

let headless = true;

for (const arg of Bun.argv) {
  if (arg.startsWith("--headless=")) {
    const val = arg.split("=")[1]?.toLowerCase();
    headless = val === "true";
  }
}

type Board = {
  id: string;
  isOpen: boolean;
  number: number | null;
  isFlagged: boolean;
}[];

async function readBoard(page: Page) {
  return await page.$$eval(
    'div.square:not([style*="display: none"])',
    (squares) => {
      return squares.map((sq) => {
        const classes = sq.className.split(" ");
        return {
          id: sq.id,
          isOpen: classes.some((c: string) => c.startsWith("open")),
          number: classes.find((c: string) => c.startsWith("open"))
            ? parseInt(
                classes
                  .find((c: string) => c.startsWith("open"))
                  .replace("open", "")
              )
            : null,
          isFlagged: classes.includes("bombflagged"),
        };
      });
    }
  );
}

async function applyFlags(board: Board, page: Page) {
  const unsafeIds = new Set();

  board.forEach((sq) => {
    if (sq.isOpen && sq.number) {
      const [x, y] = sq.id.split("_").map((nStr) => parseInt(nStr));
      let count = 0;
      let neighborIds = [];

      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (
            x + i &&
            x + i <= 16 &&
            y + j &&
            y + j <= 30 &&
            !board[(x - 1 + i) * 30 + y - 1 + j]?.isOpen
          ) {
            count++;
            neighborIds.push(board[(x - 1 + i) * 30 + y - 1 + j]?.id);
          }
        }
      }

      if (sq.number === count) {
        neighborIds.forEach((id) => {
          const [neighborX, neighborY] = id
            .split("_")
            .map((nStr) => parseInt(nStr));

          if (!board[(neighborX - 1) * 30 + neighborY - 1].isFlagged) {
            unsafeIds.add(id);
          }
        });
      }
    }
  });

  for (const id of unsafeIds) {
    const sq = page.locator(`div.square[id="${id}"]:not(.bombflagged)`);

    if ((await sq.count()) > 0) {
      await sq.click({ button: "right" });
    }
  }

  return unsafeIds.size;
}

async function openSquares(board: Board, page: Page) {
  const safeIds = new Set();

  board.forEach((sq) => {
    if (sq.isOpen && sq.number) {
      const [x, y] = sq.id.split("_").map((nStr) => parseInt(nStr));
      const flaggedNeighborIds: string[] = [];
      const unflaggedNeighborIds: string[] = [];

      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (
            x + i &&
            x + i <= 16 &&
            y + j &&
            y + j <= 30 &&
            !board[(x - 1 + i) * 30 + y - 1 + j].isOpen
          ) {
            (board[(x - 1 + i) * 30 + y - 1 + j].isFlagged
              ? flaggedNeighborIds
              : unflaggedNeighborIds
            ).push(board[(x - 1 + i) * 30 + y - 1 + j].id);
          }
        }
      }

      if (sq.number === flaggedNeighborIds.length) {
        unflaggedNeighborIds.forEach((id) => safeIds.add(id));
      }
    }
  });

  for (const id of safeIds) {
    const sq = page.locator(`div.square[id="${id}"]`);

    if ((await sq.count()) > 0) {
      await sq.click();
    }
  }

  return safeIds.size;
}

function countFlags(board: Board) {
  return board.reduce((acc, sq) => acc + (sq.isFlagged ? 1 : 0), 0);
}

function getSubarraysOfSize(arr: string[], size: number): string[][] {
  const result: string[][] = [];

  function backtrack(start: number, current: string[]) {
    if (current.length === size) {
      result.push([...current]);
      return;
    }

    for (let i = start; i < arr.length; i++) {
      current.push(arr[i] as string);
      backtrack(i + 1, current);
      current.pop();
    }
  }

  backtrack(0, []);
  return result;
}

async function guess(board: Board, page: Page) {
  for (const sq of board) {
    if (sq.isOpen && sq.number) {
      const [x, y] = sq.id.split("_").map((nStr) => parseInt(nStr)) as [
        number,
        number
      ];

      const openNumberedNeighborIds: string[] = [];
      const flaggedNeighborIds: string[] = [];
      const unflaggedNeighborIds: string[] = [];

      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (!i && !j) {
            continue;
          } else if (x + i && x + i <= 16 && y + j && y + j <= 30) {
            const neighbor = board[(x - 1 + i) * 30 + y - 1 + j];

            if (neighbor?.isOpen && neighbor?.number) {
              openNumberedNeighborIds.push(neighbor.id);
            } else if (neighbor?.isFlagged) {
              flaggedNeighborIds.push(neighbor.id);
            } else if (neighbor && !neighbor?.isOpen && !neighbor?.isFlagged) {
              unflaggedNeighborIds.push(neighbor.id);
            }
          }
        }
      }

      if (unflaggedNeighborIds.length) {
        const placements = getSubarraysOfSize(
          unflaggedNeighborIds,
          sq.number - flaggedNeighborIds.length
        );

        /*
        for each placement, we will treat placement squares as flagged
        then we will ask the open numbered neighbors if they are happy
        if any are unhappy then we reject the placement, otherwise we accept

        an open numbered neighbor will be unhappy if the number of their
            flagged neighbors plus the number of squares in the placement
            exceeds their number
        */

        const goodPlacements: string[][] = [];
        for (const placement of placements) {
          let curPlacementStatus = true;

          for (const neighborId of openNumberedNeighborIds) {
            const [neighborX, neighborY] = neighborId
              .split("_")
              .map((nStr) => parseInt(nStr)) as [number, number];

            let flaggedNeighborsCount = 0;
            let unopenedUnflaggedNeighborsCount = 0;

            for (let i = -1; i <= 1; i++) {
              for (let j = -1; j <= 1; j++) {
                if (
                  neighborX + i &&
                  neighborX + i <= 16 &&
                  neighborY + j &&
                  neighborY + j <= 30
                ) {
                  if (
                    board[(neighborX - 1 + i) * 30 + neighborY - 1 + j]
                      ?.isFlagged
                  ) {
                    flaggedNeighborsCount++;
                  }
                  if (
                    !board[(neighborX - 1 + i) * 30 + neighborY - 1 + j]
                      ?.isOpen &&
                    !board[(neighborX - 1 + i) * 30 + neighborY - 1 + j]
                      ?.isFlagged
                  ) {
                    unopenedUnflaggedNeighborsCount++;
                  }
                }
              }
            }

            if (curPlacementStatus && unopenedUnflaggedNeighborsCount) {
              // this logic is flawed and assumes all placements squares are in range of neighbor
              //   curPlacementStatus =
              //     placement.length + flaggedNeighborsCount <=
              //     board[(neighborX - 1) * 30 + neighborY - 1].number
              //       ? true
              //       : false;
              //   console.log(
              //     neighborId,
              //     placement.length + flaggedNeighborsCount,
              //     board[(neighborX - 1) * 30 + neighborY - 1].number
              //   );
            }
          }

          if (curPlacementStatus) {
            goodPlacements.push(placement);
          }
        }

        if (goodPlacements.length === 1) {
          console.log("at", sq.id, "choosing placement", goodPlacements);
          break;
        } else {
          console.log(
            "evaluated",
            sq.id,
            "found",
            goodPlacements.length,
            "/",
            placements.length,
            "good placements",
            placements
          );
        }
      }
    }
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: headless,
    slowMo: 10,
    // args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: { width: 1024, height: 672 },
  });

  const page = await context.newPage();
  await page.goto("https://minesweeperonline.com/", {
    waitUntil: "domcontentloaded",
  });

  await page.click("#display-link");
  //   await page.click("#zoom150");
  await page.click("#nightMode");
  await page.click("#display-link");

  let board: Board = [];
  let flagsApplied: number;
  let squaresOpened: number;
  let victory = false;

  while (!victory) {
    console.log("beginning new game");
    await page.click("#face");
    await page.click("#\\38_15");

    do {
      board = await readBoard(page);

      flagsApplied = await applyFlags(board, page);
      console.log(flagsApplied, "flags applied");

      squaresOpened = 0;
      do {
        board = await readBoard(page);
        squaresOpened = await openSquares(board, page);

        console.log(squaresOpened, "squares opened");
      } while (squaresOpened !== 0);
    } while (flagsApplied !== 0 || squaresOpened !== 0);

    board = await readBoard(page);
    victory = countFlags(board) === 99;

    if (countFlags(board) > 30) {
      victory = true;
    }
  }

  if (countFlags(board) === 99) {
    console.log("victory!");
  } else {
    console.log("time to guess");

    await guess(board, page);
  }
})();
