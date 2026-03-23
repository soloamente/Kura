import { notFound } from "next/navigation";
import { ProfileView } from "@/app/[username]/profile-view";

interface Props {
	params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: Props) {
	const { username } = await params;

	const res = await fetch(
		`${process.env.NEXT_PUBLIC_SERVER_URL}/users/${username}`,
		{
			cache: "no-store",
		},
	);

	if (res.status === 404) notFound();

	const profile = await res.json();

	// Session / "own profile" is resolved in ProfileView via client getSession — the API
	// cookie is not available to this RSC fetch when web and API use different origins.
	return <ProfileView profile={profile} />;
}
