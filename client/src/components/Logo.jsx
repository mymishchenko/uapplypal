// Brand logo: mark + "UApply" (navy) "Pal" (blue) wordmark.
// To use the original artwork instead, put it in client/public/logo.png and
// replace this component's contents with <img src="/logo.png" alt="UApplyPal" />.
export default function Logo({ size = 28 }) {
  return (
    <span className="logo-lockup" style={{ fontSize: size * 0.68 }}>
      <img src="/logo-mark.svg" alt="" width={size} height={size} />
      <span className="wordmark">
        <span className="wm-navy">UApply</span>
        <span className="wm-blue">Pal</span>
      </span>
    </span>
  );
}
