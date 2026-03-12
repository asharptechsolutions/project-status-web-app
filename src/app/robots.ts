import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/projects/",
          "/crm/",
          "/calendar/",
          "/settings/",
          "/templates/",
          "/workers/",
          "/track/",
          "/auth/",
          "/api/",
        ],
      },
    ],
    sitemap: "https://projectstatus.app/sitemap.xml",
  };
}
