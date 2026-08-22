type DataSourceBannerProps = {
  live: boolean;
  disclaimer: string;
};

export function DataSourceBanner({ live, disclaimer }: DataSourceBannerProps) {
  return (
    <p className={`data-banner ${live ? 'data-banner--live' : 'data-banner--mock'}`}>
      {live ? 'Live data' : 'Development data'} — {disclaimer}
    </p>
  );
}
