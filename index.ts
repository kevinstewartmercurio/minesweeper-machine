import { chromium } from "playwright";

type Board = {
  id: string;
  isOpen: boolean;
  number: number | null;
  isFlagged: boolean;
}[]

async function readBoard(page) {
  return await page.$$eval('div.square:not([style*="display: none"])', (squares) => {
    return squares.map((sq) => {
      const classes = sq.className.split(" ");
      return {
        id: sq.id,
        isOpen: classes.some((c) => c.startsWith("open")),
        number: classes.find((c) => c.startsWith("open"))
          ? parseInt(classes.find((c) => c.startsWith("open")).replace("open", ""))
          : null,
        isFlagged: classes.includes("bombflagged")
      };
    })
  })
}

function applyFlags(board: Board) {
  board.forEach((sq) => {
    if (sq.isOpen && sq.number) {
      const [x, y] = sq.id.split("_").map(nStr => parseInt(nStr))
      let count = 0;

      if (x - 1 && y - 1 && !board[(x - 2) * 30 + y - 2].isOpen && !board[(x - 2) * 30 + y - 2].isFlagged) {
        count++;
      }

      console.log(x, y, count);
    }
  })
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
  });

  const page = await browser.newPage();
  await page.goto('https://minesweeperonline.com/', {
    waitUntil: 'domcontentloaded',
  });

  await page.click("#display-link");
  await page.click("#zoom150");
  await page.click("#nightMode");
  await page.click("#display-link");

  await page.click("#\\38_15");

  const board = await readBoard(page);
  applyFlags(board);
})();
