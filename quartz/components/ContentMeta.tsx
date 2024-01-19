import { formatDate, getDate } from "./Date"
import { QuartzComponentConstructor, QuartzComponentProps } from "./types"
import readingTime from "reading-time"

export default (() => {
  function ContentMetadata({ cfg, fileData, displayClass }: QuartzComponentProps) {
    if (fileData.slug == "index") {
      return null
    }
    const text = fileData.text
    if (text) {
      const segments: string[] = []
      const { text: _timeTaken, words } = readingTime(text)

      if (fileData.dates) {
        segments.push(formatDate(getDate(cfg, fileData)!))
      }

      // segments.push(timeTaken)
      segments.push(`${words} words`)
      return <p class={`content-meta ${displayClass ?? ""}`}>{segments.join(" | ")}</p>
    } else {
      return null
    }
  }

  ContentMetadata.css = `
  .content-meta {
    margin-top: 0;
    color: var(--gray);
  }
  `
  return ContentMetadata
}) satisfies QuartzComponentConstructor
