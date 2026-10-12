/** Plain text only: imported lyrics cannot inject markup into the page. */
export class Karaoke {
  constructor(container) {
    this.container = container;
    this.lyrics = [];
    this.current = -2;
    this.previous = document.createElement("p");
    this.previous.className = "lyric-line lyric-previous";
    this.active = document.createElement("p");
    this.active.className = "lyric-line lyric-current";
    this.active.setAttribute("aria-live", "polite");
    this.next = document.createElement("p");
    this.next.className = "lyric-line lyric-next";
    this.container.replaceChildren(this.previous, this.active, this.next);
    this.setLyrics([]);
  }

  setLyrics(lyrics) {
    this.lyrics = (Array.isArray(lyrics) ? lyrics : [])
      .filter(
        (line) =>
          typeof line.text === "string" &&
          line.text.trim() &&
          Number.isFinite(line.start) &&
          Number.isFinite(line.end) &&
          line.end > line.start,
      )
      .map((line) => ({
        ...line,
        words: Array.isArray(line.words)
          ? line.words.filter(
              (word) =>
                typeof word.text === "string" &&
                Number.isFinite(word.start) &&
                Number.isFinite(word.end) &&
                word.end > word.start,
            )
          : [],
      }))
      .sort((a, b) => a.start - b.start);
    this.current = -2;
    this.update(0);
  }

  update(time) {
    if (!this.lyrics.length) {
      if (this.current !== -3) {
        this.previous.textContent = "LOCAL LYRICS";
        this.active.textContent = "Make room for your voice.";
        this.next.textContent =
          "Lyrics are not included. Import your own timed lyrics with a melody map.";
        this.container.classList.add("lyrics-empty");
        this.current = -3;
      }
      return;
    }
    this.container.classList.remove("lyrics-empty");
    const index = this.lyrics.findIndex(
      (line) => time >= line.start && time < line.end,
    );
    if (index !== this.current) {
      this.current = index;
      if (index >= 0) {
        this.previous.textContent = this.lyrics[index - 1]?.text || "";
        this.next.textContent = this.lyrics[index + 1]?.text || "";
        this.active.replaceChildren();
        const line = this.lyrics[index];
        if (line.words.length) {
          for (const word of line.words) {
            const span = document.createElement("span");
            span.className = "lyric-word";
            span.textContent = `${word.text} `;
            this.active.append(span);
          }
        } else this.active.textContent = line.text;
      } else {
        const upcoming = this.lyrics.findIndex((line) => line.start > time);
        this.previous.textContent =
          upcoming === -1
            ? this.lyrics.at(-1).text
            : this.lyrics[upcoming - 1]?.text || "";
        this.active.textContent =
          upcoming === -1
            ? "Practice complete"
            : "Instrumental · listen for your entrance";
        this.next.textContent =
          upcoming === -1 ? "" : this.lyrics[upcoming].text;
      }
    }
    if (index >= 0 && this.lyrics[index].words.length) {
      this.lyrics[index].words.forEach((word, i) => {
        this.active.children[i].classList.toggle(
          "is-active",
          time >= word.start && time < word.end,
        );
        this.active.children[i].classList.toggle("is-sung", time >= word.end);
      });
    }
  }
}
