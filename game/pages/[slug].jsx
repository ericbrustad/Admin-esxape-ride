// game/pages/[slug].jsx
export async function getServerSideProps({ params, query }) {
  const { slug } = params || {};
  const channel = query.channel || 'published';
  const preview = query.preview ? `&preview=${encodeURIComponent(query.preview)}` : '';

  // Always redirect to the index page, which already knows how to read ?slug=
  return {
    redirect: {
      destination: `/?slug=${encodeURIComponent(slug)}&channel=${encodeURIComponent(channel)}${preview}`,
      permanent: false,
    },
  };
}

export default function SlugRedirect() { return null; }
