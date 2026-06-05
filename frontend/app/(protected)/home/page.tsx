import { HomeFilesContainer } from "@/components/home-files-container"

export default function HomePage() {
  return (
    <div className="page-container">
      <div className="page-content-wrapper">
        <div className="page-header">
          <h1 className="page-title">Home</h1>
          <p className="page-description">
            Browse all wildlife uploads or view files you have uploaded.
          </p>
        </div>
        <HomeFilesContainer />
      </div>
    </div>
  )
}
