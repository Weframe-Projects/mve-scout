export default function PlatformLogo({
  platform,
  size = 16,
}: {
  platform: "instagram" | "tiktok";
  size?: number;
}) {
  if (platform === "instagram") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient
            id="ig-gradient"
            cx="30%"
            cy="107%"
            r="150%"
          >
            <stop offset="0%" stopColor="#fdf497" />
            <stop offset="5%" stopColor="#fdf497" />
            <stop offset="45%" stopColor="#fd5949" />
            <stop offset="60%" stopColor="#d6249f" />
            <stop offset="90%" stopColor="#285AEB" />
          </radialGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="20"
          height="20"
          rx="6"
          fill="url(#ig-gradient)"
        />
        <circle
          cx="12"
          cy="12"
          r="4.5"
          stroke="white"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V9.42a8.16 8.16 0 0 0 4.76 1.52v-3.4a4.85 4.85 0 0 1-1-.85z"
        fill="#010101"
      />
    </svg>
  );
}
