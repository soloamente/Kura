import { env } from "@Kura/env/web";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileView } from "@/app/[username]/profile-view";
import {
	getPublicProfileDescription,
	getPublicProfileTitle,
} from "@/lib/profile-metadata";

interface Props {
	params: Promise<{ username: string }>;
}

interface PublicProfilePayload {
	name: string;
	username: string;
	bio: string | null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { username } = await params;
	const canonical = `https://${username}.${env.NEXT_PUBLIC_PROFILE_DOMAIN}`;

	const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL;
	if (!serverUrl) {
		return {
			title: getPublicProfileTitle("", username),
			description: getPublicProfileDescription(null, username),
			alternates: { canonical },
			openGraph: { url: canonical },
		};
	}

	const res = await fetch(`${serverUrl}/users/${username}`, {
		cache: "no-store",
	});

	if (res.status === 404) {
		notFound();
	}

	if (!res.ok) {
		return {
			title: getPublicProfileTitle("", username),
			description: getPublicProfileDescription(null, username),
			alternates: { canonical },
			openGraph: { url: canonical },
		};
	}

	const profile = (await res.json()) as PublicProfilePayload;
	const title = getPublicProfileTitle(profile.name, profile.username);
	const description = getPublicProfileDescription(profile.bio, profile.username);

	return {
		title,
		description,
		alternates: { canonical },
		openGraph: {
			url: canonical,
			title,
			description,
			type: "website",
			siteName: "Cura",
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
		},
	};
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
