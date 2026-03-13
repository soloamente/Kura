import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProfileView } from "@/app/[username]/profile-view";
import { authClient } from "@/lib/auth-client";

interface Props {
	params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: Props) {
	const { username } = await params;

	// fetch profile from server
	const res = await fetch(
		`${process.env.NEXT_PUBLIC_SERVER_URL}/users/${username}`,
		{
			headers: Object.fromEntries(await headers()),
			cache: "no-store",
		},
	);

	if (res.status === 404) notFound();

	const profile = await res.json();

	// get current session to know if we're viewing our own profile
	const session = await authClient.getSession({
		fetchOptions: {
			headers: Object.fromEntries(await headers()),
			throw: false,
		},
	});

	const isOwnProfile = session?.data?.user?.id === profile.id;

	return <ProfileView profile={profile} isOwnProfile={isOwnProfile} />;
}
