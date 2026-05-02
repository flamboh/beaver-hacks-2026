import Header from "@renderer/components/_Home/Header"
import Gallery from "@renderer/components/_Home/Gallery"
import type { JSX } from "react"

export default function Home(): JSX.Element {
  return (
    <>
      <Header />
      <Gallery />
    </>
  )
}
