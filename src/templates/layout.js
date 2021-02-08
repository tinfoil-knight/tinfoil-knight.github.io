import React from 'react'
import { Link } from 'gatsby'

export default function Layout({ children }) {
	return (
		<div className="px-4 sm:px-8 md:px-24">
			<NavBar />
			<Content>{children}</Content>
			<Footer />
		</div>
	)
}

const Content = ({ children }) => {
	return (
		<article className="container mx-auto max-w-screen-sm">{children}</article>
	)
}

const NavBar = () => {
	return (
		<section className="my-8 sm:flex sm:justify-between">
			<div className="text-2xl text-center sm:text-left">Kunal Kundu</div>
			<nav className="flex space-x-2 sm:space-x-4 justify-center sm:justify-start">
				<Link to="/archive" className="hover:text-blood-red">
					Posts
				</Link>
				<Link to="/" className="hover:text-blood-red">
					About
				</Link>
			</nav>
		</section>
	)
}

const Footer = () => {
	return <footer className="mt-20"></footer>
}
