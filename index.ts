import { chromium } from "playwright";

let headless = true;

for (const arg of Bun.argv) {
  if (arg.startsWith("--headless=")) {
    const val = arg.split("=")[1].toLowerCase();
    headless = val === "true";
  }
}

type Board = {
  id: string;
  isOpen: boolean;
  number: number | null;
  isFlagged: boolean;
}[];

async function readBoard(page) {
  return await page.$$eval(
    'div.square:not([style*="display: none"])',
    (squares) => {
      return squares.map((sq) => {
        const classes = sq.className.split(" ");
        return {
          id: sq.id,
          isOpen: classes.some((c) => c.startsWith("open")),
          number: classes.find((c) => c.startsWith("open"))
            ? parseInt(
                classes.find((c) => c.startsWith("open")).replace("open", ""),
              )
            : null,
          isFlagged: classes.includes("bombflagged"),
        };
      });
    },
  );
}

async function applyFlags(board: Board, page) {
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
            !board[(x - 1 + i) * 30 + y - 1 + j].isOpen
          ) {
            count++;
            neighborIds.push(board[(x - 1 + i) * 30 + y - 1 + j].id);
          }
        }
      }

      if (sq.number === count) {
        neighborIds.forEach((id) => {
          unsafeIds.add(id);
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

async function openSquares(board: Board, page) {
  const safeIds = new Set();

  board.forEach((sq) => {
    if (sq.isOpen && sq.number) {
      const [x, y] = sq.id.split("_").map((nStr) => parseInt(nStr));
      const flaggedNeighborIds = [];
      const unflaggedNeighborIds = [];

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

(async () => {
  const browser = await chromium.launch({
    headless: headless,
    slowMo: 200,
    args: ["--start-maximized"],
  });

  const context = await browser.newContext({
    viewport: null,
  });

  const page = await context.newPage();
  await page.goto("https://minesweeperonline.com/", {
    waitUntil: "domcontentloaded",
  });

  await page.click("#display-link");
  await page.click("#zoom200");
  await page.click("#nightMode");
  await page.click("#display-link");

  await page.click("#\\38_15");

  // let board = await readBoard(page);
  // let flagsApplied: number | null = null;
  // let squaresOpened: number | null = null;
  //
  // while (!(flagsApplied === 0 && squaresOpened === 0)) {
  //   flagsApplied = await applyFlags(board, page);
  //   console.log(flagsApplied, "flags applied");
  //
  //   while (squaresOpened !== 0) {
  //     board = await readBoard(page);
  //     squaresOpened = await openSquares(board, page);
  //     console.log(squaresOpened, "squares opened");
  //   }
  // }

  let board: Board;
  let flagsApplied: number;
  let squaresOpened: number;

  do {
    board = await readBoard(page);

    flagsApplied = await applyFlags(board, page);
    console.log(flagsApplied, "flags applied");

    squaresOpened = 0;
    let opened;
    do {
      board = await readBoard(page);
      opened = await openSquares(board, page);
      squaresOpened += opened;

      if (opened > 0) {
        console.log(opened, "squares opened");
      }
    } while (opened !== 0);
  } while (flagsApplied !== 0 || squaresOpened !== 0);

  console.log("halting");
})();
