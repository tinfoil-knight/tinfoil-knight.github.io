import React from 'react'
import { Link } from 'gatsby'
import { Helmet } from 'react-helmet'

import Layout from '../templates/layout'

const A = ({ to, text }) => {
	return (
		<a href={to} className="underline">
			{text}
		</a>
	)
}

export default function About() {
	return (
		<Layout>
			<Helmet>
				<title>Kunal K • About</title>
			</Helmet>
			<div className="space-y-4 mt-20 md:px-16">
				<p>
					I'm a software developer. Currently working remotely at&nbsp;
					<a
						className="hover:text-blue-500"
						href="https://bimape.com"
						target="_blank"
						rel="noreferrer"
					>
						BimaPe
					</a>
					.
				</p>
				<p>
					I like to dabble in everything from design systems on the frontend to
					infrastructure as code alongside writing silly shell scripts to
					automate everything.
				</p>
				<p>
					I occasionally write stuff&nbsp;
					<Link to="/posts" className="underline">
						here
					</Link>
					.
				</p>
				<p>
					Feel free to reach out on kunal99kundu@gmail.com or just DM me
					on&nbsp;
					<A text="Twitter" to="https://twitter.com/kunal__kundu" />. I'm also
					on&nbsp;
					<A text="LinkedIn" to="https://www.linkedin.com/in/kunal-kundu/" />
					&nbsp;and&nbsp;
					<A text="Github" to="https://github.com/tinfoil-knight" />.
				</p>
				{/* <p>
					See my&nbsp;
					<A
						text="résumé"
						to="https://www.notion.so/Kunal-Kundu-005f8e516d7e4f81aa360c66fe19c0c0"
					/>
				</p> */}
			</div>
		</Layout>
	)
}
