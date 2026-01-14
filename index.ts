import { chromium } from "playwright";

async function readBoard(page) {
  return await page.$$eval("div.square", (squares) => {
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
  board.forEach((sq) => {
    if (sq.isOpen) {
      console.log(sq)
    }
  })
})();
