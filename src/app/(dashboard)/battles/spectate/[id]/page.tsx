import { StudioDirector } from "./studio-director";

export const metadata = {
  title: "Studio Director — CodePulse",
  description: "Multi-perspective live esports spectator studio with automated director AI",
};

export default function SpectatePage({ params }: { params: { id: string } }) {
  return <StudioDirector battleId={params.id} />;
}
