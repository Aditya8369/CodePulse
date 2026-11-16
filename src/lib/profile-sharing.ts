export function profileUrl(origin: string, username: string): string {
  return `${origin}/profile/${encodeURIComponent(username)}`;
}

export function profileShareLinks(url: string) {
  const message = `Check out my developer stats and battle rank on CodePulse! 🔥 ${url}`;
  return {
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
  };
}
