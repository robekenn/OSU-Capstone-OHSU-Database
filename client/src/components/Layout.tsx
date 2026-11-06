import type { MouseEvent } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const MAIN_ID = 'main-content'

// Moves focus into <main> without changing the URL. A plain href="#main-content"
// would add a history entry, so Back would need an extra press to leave the page.
// The href stays so the link still works if this handler never runs.
function skipToMain(event: MouseEvent<HTMLAnchorElement>) {
  const main = document.getElementById(MAIN_ID)
  if (!main) return
  event.preventDefault()
  main.focus()
  main.scrollIntoView()
}

export default function Layout() {
  return (
    <>
      <a className="skip-link" href={`#${MAIN_ID}`} onClick={skipToMain}>
        Skip to main content
      </a>

      <header className="site-header">
        <p className="site-name">OHSU Simulation Database</p>
        <nav aria-label="Main">
          <ul className="nav-list">
            <li>
              <NavLink to="/new">New case</NavLink>
            </li>
            <li>
              <NavLink to="/cases">Cases</NavLink>
            </li>
          </ul>
        </nav>
      </header>

      {/* tabIndex -1 lets the skip link focus <main> without adding it to the Tab order */}
      <main id={MAIN_ID} tabIndex={-1}>
        <Outlet />
      </main>
    </>
  )
}
