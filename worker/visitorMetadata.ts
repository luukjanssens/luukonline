export interface VisitorMetadata {
	ip: string | null;
	country: string | null;
	city: string | null;
	region: string | null;
	postalCode: string | null;
	latitude: string | null;
	longitude: string | null;
	timezone: string | null;
	organization: string | null;
	userAgent: string | null;
	language: string | null;
	referer: string | null;
}

export function extractVisitorMetadata(request: Request): VisitorMetadata {
	const cloudflare = request.cf;
	return {
		ip: request.headers.get("CF-Connecting-IP"),
		country: (cloudflare?.country as string) ?? null,
		city: (cloudflare?.city as string) ?? null,
		region: (cloudflare?.region as string) ?? null,
		postalCode: (cloudflare?.postalCode as string) ?? null,
		latitude: (cloudflare?.latitude as string) ?? null,
		longitude: (cloudflare?.longitude as string) ?? null,
		timezone: (cloudflare?.timezone as string) ?? null,
		organization: (cloudflare?.asOrganization as string) ?? null,
		userAgent: request.headers.get("User-Agent"),
		language: request.headers.get("Accept-Language"),
		referer: request.headers.get("Referer"),
	};
}

export function formatMetadataLines(metadata: VisitorMetadata): string {
	const location = [
		metadata.city,
		metadata.postalCode,
		metadata.region,
		metadata.country,
	]
		.filter(Boolean)
		.join(", ");

	return [
		location && `🌍 ${location}`,
		metadata.timezone && `🕐 ${metadata.timezone}`,
		metadata.organization && `📡 ${metadata.organization}`,
		metadata.ip && `🔗 ${metadata.ip}`,
		metadata.referer && `↩️ ${metadata.referer}`,
		metadata.language && `🗣️ ${metadata.language}`,
		metadata.userAgent && `🖥️ ${metadata.userAgent}`,
	]
		.filter(Boolean)
		.join("\n");
}
