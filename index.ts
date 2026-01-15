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
  const bombIdsForFlagging = new Set();

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
          bombIdsForFlagging.add(id);

          const [bombX, bombY] = id.split("_").map((nStr) => parseInt(nStr));
          board[(bombX - 1) * 30 + bombY - 1].isFlagged = true;
        });
      }
    }
  });

  for (const id of bombIdsForFlagging) {
    const sq = page.locator(`div.square[id="${id}"]:not(.bombflagged)`);

    if ((await sq.count()) > 0) {
      await sq.click({ button: "right" });
    }
  }
}

(async () => {
  const browser = await chromium.launch({
    headless: headless,
    slowMo: 200,
  });

  const page = await browser.newPage();
  await page.goto("https://minesweeperonline.com/", {
    waitUntil: "domcontentloaded",
  });

  await page.click("#display-link");
  await page.click("#zoom150");
  await page.click("#nightMode");
  await page.click("#display-link");

  await page.click("#\\38_15");

  const board = await readBoard(page);
  applyFlags(board, page);
})();
