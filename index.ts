import { chromium, type Page } from "playwright";

let headless = true;
let size = "sm";
let diff = "expert";
let rows = 16;
let cols = 30;
let mines = 99;

for (const arg of Bun.argv) {
  if (arg.startsWith("--headless=")) {
    const val = arg.split("=")[1]?.toLowerCase();
    headless = val === "true";
  } else if (arg.startsWith("--size=")) {
    const val = arg.split("=")[1]?.toLowerCase();
    size = val === "lg" ? "lg" : val === "md" ? "md" : "sm";
  } else if (arg.startsWith("--difficulty")) {
    const val = arg.split("=")[1]?.toLowerCase();
    switch (val) {
      case "beginner":
        diff = "beginner";
        rows = 9;
        cols = 9;
        mines = 10;
        break;
      case "intermediate":
        diff = "intermediate";
        rows = 16;
        cols = 16;
        mines = 40;
        break;
      default:
        break;
    }
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
                  .replace("open", ""),
              )
            : null,
          isFlagged: classes.includes("bombflagged"),
        };
      });
    },
  );
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

function intersection(arrs: string[][]) {
  const retArr = arrs.reduce((acc, cur) => {
    return acc.filter((s) => cur.includes(s));
  });

  return retArr;
}

async function phase1(board: Board, page: Page) {
  const safeIds = new Set();
  const unsafeIds = new Set();

  board.forEach((sq) => {
    if (sq.isOpen && sq.number) {
      const [x, y] = sq.id.split("_").map((nStr) => parseInt(nStr)) as [
        number,
        number,
      ];
      const flaggedNeighborIds: string[] = [];
      const unflaggedNeighborIds: string[] = [];

      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (
            x + i &&
            x + i <= rows &&
            y + j &&
            y + j <= cols &&
            !board[(x - 1 + i) * cols + y - 1 + j]?.isOpen &&
            typeof board[(x - 1 + i) * cols + y - 1 + j]?.id === "string"
          ) {
            (board[(x - 1 + i) * cols + y - 1 + j]?.isFlagged
              ? flaggedNeighborIds
              : unflaggedNeighborIds
            ).push(board[(x - 1 + i) * cols + y - 1 + j]?.id as string);
          }
        }
      }

      if (
        sq.number ===
        flaggedNeighborIds.length + unflaggedNeighborIds.length
      ) {
        [...flaggedNeighborIds, ...unflaggedNeighborIds].forEach(
          (id: string) => {
            const [neighborX, neighborY] = id
              .split("_")
              .map((nStr) => parseInt(nStr)) as [number, number];

            if (!board[(neighborX - 1) * cols + neighborY - 1]?.isFlagged) {
              unsafeIds.add(id);
            }
          },
        );
      }

      if (sq.number === flaggedNeighborIds.length) {
        unflaggedNeighborIds.forEach((id) => safeIds.add(id));
      }
    }
  });

  for (const id of unsafeIds) {
    const sq = page.locator(`div.square[id="${id}"]:not(.bombflagged)`);

    if ((await sq.count()) > 0) {
      await sq.click({ button: "right" });
    }
  }

  for (const id of safeIds) {
    const sq = page.locator(`div.square[id="${id}"]`);

    if ((await sq.count()) > 0) {
      await sq.click();
    }
  }

  return [unsafeIds.size, safeIds.size];
}

async function phase2(board: Board, page: Page): Promise<[number, number]> {
  const unsafeIds = new Set();
  const safeIds = new Set();

  for (const sq of board) {
    if (sq.isOpen && sq.number) {
      const [x, y] = sq.id.split("_").map((nStr) => parseInt(nStr)) as [
        number,
        number,
      ];

      const openNumberedNeighborIds: string[] = [];
      const flaggedNeighborIds: string[] = [];
      const unflaggedNeighborIds: string[] = [];

      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (!i && !j) {
            continue;
          } else if (x + i && x + i <= rows && y + j && y + j <= cols) {
            const neighbor = board[(x - 1 + i) * cols + y - 1 + j];

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
          sq.number - flaggedNeighborIds.length,
        );

        const goodPlacements: string[][] = [];
        for (const placement of placements) {
          let curPlacementStatus = true;
          const placementSet = new Set([...placement]);

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
                  neighborX + i <= rows &&
                  neighborY + j &&
                  neighborY + j <= cols
                ) {
                  if (
                    board[(neighborX - 1 + i) * cols + neighborY - 1 + j]
                      ?.isFlagged ||
                    placementSet.has(`${neighborX + i}_${neighborY + j}`)
                  ) {
                    flaggedNeighborsCount++;
                  }
                  if (
                    !board[(neighborX - 1 + i) * cols + neighborY - 1 + j]
                      ?.isOpen &&
                    !board[(neighborX - 1 + i) * cols + neighborY - 1 + j]
                      ?.isFlagged
                  ) {
                    unopenedUnflaggedNeighborsCount++;
                  }
                }
              }
            }

            if (curPlacementStatus && unopenedUnflaggedNeighborsCount) {
              curPlacementStatus =
                flaggedNeighborsCount <=
                (board[(neighborX - 1) * cols + neighborY - 1]
                  ?.number as number)
                  ? true
                  : false;
            }
          }

          if (curPlacementStatus) {
            goodPlacements.push(placement);
          }
        }

        if (goodPlacements.length === 1) {
          goodPlacements[0]?.forEach((id) => unsafeIds.add(id));
          unflaggedNeighborIds.forEach((id) => {
            if (!goodPlacements[0]?.includes(id)) {
              safeIds.add(id);
            }
          });
        } else if (
          goodPlacements.length > 1 &&
          goodPlacements[0] &&
          goodPlacements[0].length > 1
        ) {
          intersection(goodPlacements).forEach((id) => unsafeIds.add(id));
        }
      }
    }
  }

  for (const id of unsafeIds) {
    const sq = page.locator(`div.square[id="${id}"]:not(.bombflagged)`);

    if ((await sq.count()) > 0) {
      await sq.click({ button: "right" });
    }
  }
  for (const id of safeIds) {
    const sq = page.locator(`div.square[id="${id}"]`);

    if ((await sq.count()) > 0) {
      await sq.click();
    }
  }

  return [unsafeIds.size, safeIds.size];
}

async function sweep(board: Board, page: Page) {
  // assumes all mines have been flagged
  for (const sqObj of board) {
    if (!sqObj.isOpen && !sqObj.isFlagged) {
      const sq = page.locator(`div.square[id="${sqObj.id}"]`);

      if ((await sq.count()) > 0) {
        await sq.click();
      }
    }
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: headless,
    slowMo: 5,
  });

  const context = await browser.newContext({
    viewport: {
      width: size === "lg" ? 1280 : size === "md" ? 1024 : 672,
      height: size === "lg" ? 896 : size === "md" ? 768 : 512,
    },
  });

  const page = await context.newPage();
  await page.goto("https://minesweeperonline.com/", {
    waitUntil: "domcontentloaded",
  });

  await page.click("#options-link");
  await page.click(`#${diff}`);
  await page.click("#options-link");

  await page.click("#display-link");
  await page.click(`#zoom${size === "lg" ? 200 : size === "md" ? 150 : 100}`);
  await page.click("#nightMode");
  await page.click("#display-link");

  let board: Board = [];

  console.log("beginning new game");
  await page.click("#face");
  const startMove = `#\\3${diff === "beginner" ? "4_4" : diff === "intermediate" ? "8_8" : "8_15"}`;
  await page.click(startMove);

  while (true) {
    board = await readBoard(page);
    const [squaresFlaggedP1, squaresOpenedP1] = await phase1(board, page);

    if (squaresFlaggedP1 || squaresOpenedP1) {
      console.log(
        squaresFlaggedP1,
        "squares flagged",
        squaresOpenedP1,
        "squaresOpened (P1)",
      );
      continue;
    }

    board = await readBoard(page);
    const [squaresFlaggedP2, squaresOpenedP2] = await phase2(board, page);

    if (squaresFlaggedP2 || squaresOpenedP2) {
      console.log(
        squaresFlaggedP2,
        "squares flagged",
        squaresOpenedP2,
        "squares opened (P2)",
      );
      continue;
    }

    if (countFlags(board) === mines) {
      board = await readBoard(page);
      await sweep(board, page);
      console.log("victory!");
    } else {
      console.log("No moves left (P1 or P2). Halting.");
    }
    break;
  }
})();
