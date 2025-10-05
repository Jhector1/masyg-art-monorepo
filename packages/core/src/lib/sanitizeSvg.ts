// src/lib/sanitizeSvg.ts
import sanitizeHtml from 'sanitize-html';

export const SVG_ALLOWED_TAGS = [
  'svg','g','path','rect','circle','text','defs',
  'linearGradient','radialGradient','stop',
  'polygon','line','ellipse','polyline','pattern','image',
  'lineargradient','radialgradient',
];

export const SVG_ALLOWED_ATTRS: Record<string, string[]> = {
  '*': [
    'id',
    'x','y','width','height','viewBox','fill','stroke','d','points',
    'font-size','text-anchor','font-family','style','stroke-width',
    // gradients
    'gradientUnits','gradientTransform','spreadMethod','x1','y1','x2','y2',
    'cx','cy','r','fx','fy',
    // patterns
    'patternUnits','patternContentUnits','patternTransform',
    // links/images
    'preserveAspectRatio','href','xlink:href',
  ],
};

// lowercase → camelCase defense
const TRANSFORM_TAGS = {
  lineargradient: (_: any, a: any) => ({ tagName: 'linearGradient', attribs: a }),
  radialgradient:  (_: any, a: any) => ({ tagName: 'radialGradient',  attribs: a }),
};

export function sanitizeSvg(svg: string) {
  return sanitizeHtml(svg, {
    allowedTags: SVG_ALLOWED_TAGS,
    allowedAttributes: {
      ...SVG_ALLOWED_ATTRS,
      // Be explicit for gradients/patterns/stop as some sanitize-html versions
      // are stricter with '*' for SVG-namespaced tags:
      linearGradient: ['id','gradientUnits','gradientTransform','spreadMethod','x1','y1','x2','y2'],
      radialGradient:  ['id','gradientUnits','gradientTransform','spreadMethod','cx','cy','r','fx','fy'],
      pattern:         ['id','x','y','width','height','viewBox','patternUnits','patternContentUnits','patternTransform'],
      image:           ['href','xlink:href','x','y','width','height','preserveAspectRatio'],
      stop:            ['offset','stop-color','stop-opacity','style'], // <— critical
    },
    allowedSchemes: ['data','http','https'],
    parser: { lowerCaseTags:false, lowerCaseAttributeNames:false, xmlMode:true },
    transformTags: TRANSFORM_TAGS,
  });
}

// For incoming <defs> fragments
export function sanitizeDefs(defsFrag: string) {
  return sanitizeHtml(defsFrag, {
    allowedTags: [
      'defs','linearGradient','radialGradient','stop','pattern','image',
      'g','path','rect','circle','polygon','line','ellipse','polyline',
      'lineargradient','radialgradient',
    ],
    allowedAttributes: {
      '*': SVG_ALLOWED_ATTRS['*'],
      linearGradient: ['id','gradientUnits','gradientTransform','spreadMethod','x1','y1','x2','y2'],
      radialGradient:  ['id','gradientUnits','gradientTransform','spreadMethod','cx','cy','r','fx','fy'],
      pattern:         ['id','x','y','width','height','viewBox','patternUnits','patternContentUnits','patternTransform'],
      image:           ['href','xlink:href','x','y','width','height','preserveAspectRatio'],
      stop:            ['offset','stop-color','stop-opacity','style'], // <— critical
    },
    allowedSchemes: ['data','http','https'],
    parser: { lowerCaseTags:false, lowerCaseAttributeNames:false, xmlMode:true },
    transformTags: TRANSFORM_TAGS,
  });
}
