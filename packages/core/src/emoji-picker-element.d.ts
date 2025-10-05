// # Install these deps
// # (React 19 friendly)
// #
// # 1) Konva for drag/resize/rotate
// # 2) emoji-picker-element (web component, no React peer-deps)
// # 3) html2canvas & react-color if you don't already have them
// #
// # npm i react-konva konva emoji-picker-element html2canvas react-color




// ============================
// types/emoji-picker-element.d.ts
// ============================
declare module "emoji-picker-element";


declare namespace JSX {
interface IntrinsicElements {
"emoji-picker": React.DetailedHTMLProps<
React.HTMLAttributes<HTMLElement>,
HTMLElement
> & {
class?: string;
style?: React.CSSProperties;
"skin-tone-emoji"?: string;
"default-skin-tone"?: string | number;
};
}
}