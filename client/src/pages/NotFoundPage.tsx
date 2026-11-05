import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="simple-page">
      <h1>Page not found</h1>
      <p>
        There's no page at this address. <Link to="/cases">Go to Cases</Link>.
      </p>
    </section>
  )
}
