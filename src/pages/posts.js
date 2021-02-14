import React from 'react'
import { Link, graphql } from 'gatsby'
import { Helmet } from 'react-helmet'

import Layout from '../templates/layout'

export default function Archive({ data }) {
	return (
		<Layout>
			<Helmet>
				<title>Kunal K • Posts</title>
			</Helmet>
			<h1 className="text-3xl mb-3">Posts</h1>
			{/* <h4>{data.allMarkdownRemark.totalCount} Post(s)</h4> */}
			<section className="ml-0.5">
				{data.allMarkdownRemark.edges.map(({ node }) => (
					<div key={node.id}>
						<Link to={node.fields.slug}>
							<span className="opacity-80">{node.frontmatter.date} : </span>
							<span>{node.frontmatter.title}</span>
						</Link>
					</div>
				))}
			</section>
		</Layout>
	)
}

export const query = graphql`
	query {
		allMarkdownRemark(sort: { fields: [frontmatter___date], order: DESC }) {
			totalCount
			edges {
				node {
					id
					frontmatter {
						title
						date(formatString: "MMM 'YY")
					}
					fields {
						slug
					}
				}
			}
		}
	}
`
