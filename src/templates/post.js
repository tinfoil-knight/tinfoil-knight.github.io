import React from 'react'
import { graphql } from 'gatsby'
import { Helmet } from 'react-helmet'

import Layout from './layout'

export default function BlogPost({ data }) {
	const post = data.markdownRemark
	return (
		<Layout>
			<Helmet>
				<title>Kunal K • {post.frontmatter.title}</title>
			</Helmet>
			<div>
				<h1 className="text-2xl mb-6">{post.frontmatter.title}</h1>
				<div dangerouslySetInnerHTML={{ __html: post.html }} />
			</div>
		</Layout>
	)
}

export const query = graphql`
	query($slug: String!) {
		markdownRemark(fields: { slug: { eq: $slug } }) {
			html
			frontmatter {
				title
			}
		}
	}
`
