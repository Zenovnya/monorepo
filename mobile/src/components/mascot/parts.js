/**
 * Все части медведя как компоненты react-native-svg.
 *
 * Каждая часть нарисована в общем canvas 400×520 (для тела/рук) или 400×400
 * (для лица). Координаты у всех частей АБСОЛЮТНЫЕ и совпадают между собой —
 * если сложить все части в стек (position:absolute одного размера),
 * получится собранный медведь без дополнительных трансформаций.
 *
 * Стиль: мультяшный костюмный медведь (по мотивам Duolingo-owl эстетики):
 *  - тёплый коричневый мех, тёмная толстая обводка ~5px,
 *  - светлая (охра) мордочка,
 *  - большие круглые глаза с бликами,
 *  - костюм-тройка + флажок РФ на груди,
 *  - руки опущены по бокам от корпуса (не наезжают на грудь).
 *
 * Файлы-источники: mobile/assets/mascot/*.svg — используйте их как ground
 * truth при правках в Illustrator/Inkscape и потом синхронизируйте JSX.
 */
import React from 'react';
import Svg, {
  Circle,
  Ellipse,
  G,
  Path,
  Polygon,
  Rect,
} from 'react-native-svg';

/** Общие размеры и pivot-точки — используются рига'ющими анимациями. */
export const MASCOT_CANVAS = { width: 400, height: 520 };
export const FACE_CANVAS = { width: 400, height: 400 };

export const PIVOTS = {
  head: { x: 200, y: 310 },     // основание шеи — центр вращения головы
  earL: { x: 115, y: 175 },
  earR: { x: 285, y: 175 },
  shoulderL: { x: 145, y: 305 },
  shoulderR: { x: 255, y: 305 },
};

// Единые стилевые константы (аналог CSS-классов "outline"/"outline-thin"
// из веб-версии — в react-native-svg нельзя описать через <style>).
const INK = '#2A1810';
const outline = { stroke: INK, strokeWidth: 5, strokeLinejoin: 'round', strokeLinecap: 'round' };
const outlineThin = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' };

const FACE_VB = '0 0 400 400';
const BODY_VB = '0 0 400 520';

// ============================================================
// BODY — костюм-тройка + ноги + ботинки + галстук + флажок РФ
// ============================================================
export const BodyPart = () => (
  <Svg viewBox={BODY_VB} width="100%" height="100%">
    {/* Ноги + брюки (раздвинуты, ботинки не пересекаются) */}
    <Path
      d="M 148 420 Q 146 470 150 495 Q 152 502 162 502 L 188 502 Q 192 495 192 470 L 192 420 Z"
      fill="#3D2A1B"
      {...outline}
    />
    <Path
      d="M 208 420 L 208 470 Q 208 495 212 502 L 238 502 Q 248 502 250 495 Q 252 470 252 420 Z"
      fill="#3D2A1B"
      {...outline}
    />
    {/* Ботинки */}
    <Ellipse cx={172} cy={502} rx={24} ry={10} fill="#1F140A" {...outline} />
    <Ellipse cx={228} cy={502} rx={24} ry={10} fill="#1F140A" {...outline} />

    {/* Пиджак */}
    <Path
      d="M 120 310 Q 115 355 118 400 Q 122 445 145 452 L 255 452 Q 278 445 282 400 Q 285 355 280 310 Q 260 295 200 295 Q 140 295 120 310 Z"
      fill="#3D2A1B"
      {...outline}
    />
    {/* Лацканы */}
    <Path
      d="M 155 305 L 200 385 L 245 305 L 235 305 L 200 365 L 165 305 Z"
      fill="#2A1A0F"
      {...outlineThin}
    />

    {/* Рубашка (треугольник в вырезе) */}
    <Path d="M 175 305 L 200 355 L 225 305 Z" fill="#F0E8D8" {...outlineThin} />
    {/* Воротник */}
    <Path
      d="M 175 305 L 195 325 L 200 315 L 205 325 L 225 305"
      fill="#F0E8D8"
      {...outlineThin}
    />

    {/* Галстук: узел + тело (+8% длины) */}
    <Path d="M 195 320 L 190 335 L 210 335 L 205 320 Z" fill="#6B2E1E" {...outlineThin} />
    <Path d="M 190 335 L 187 384 Q 200 389 213 384 L 210 335 Z" fill="#7A3823" {...outlineThin} />

    {/* Флажок России — на груди правее галстука */}
    <G transform="translate(225 340)">
      <Rect x={0} y={0} width={20} height={16} fill="#F5F5F5" stroke={INK} strokeWidth={1.5} />
      <Rect x={0} y={0} width={20} height={5.3} fill="#F5F5F5" />
      <Rect x={0} y={5.3} width={20} height={5.4} fill="#0039A6" />
      <Rect x={0} y={10.7} width={20} height={5.3} fill="#D52B1E" />
    </G>

    {/* Пуговицы жилетки */}
    <Circle cx={200} cy={395} r={2.5} fill={INK} />
    <Circle cx={200} cy={415} r={2.5} fill={INK} />
  </Svg>
);

// ============================================================
// HEAD BASE — голова без ушей + мордочка
// ============================================================
export const HeadBasePart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path
      d="M 200 100 C 285 100 305 175 305 210 C 305 260 285 295 240 300 Q 220 302 200 302 Q 180 302 160 300 C 115 295 95 260 95 210 C 95 175 115 100 200 100 Z"
      fill="#7B4823"
      {...outline}
    />
    {/* Мордочка */}
    <Ellipse cx={200} cy={245} rx={65} ry={45} fill="#C89066" {...outlineThin} />
    {/* Лёгкая тень под носом */}
    <Path
      d="M 175 240 Q 200 235 225 240"
      stroke="#B58256"
      strokeWidth={1.5}
      fill="none"
      opacity={0.5}
    />
  </Svg>
);

// ============================================================
// EARS
// ============================================================
export const EarLeftPart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Circle cx={115} cy={140} r={38} fill="#7B4823" {...outline} />
    <Circle cx={115} cy={145} r={20} fill="#C89066" />
  </Svg>
);
export const EarRightPart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Circle cx={285} cy={140} r={38} fill="#7B4823" {...outline} />
    <Circle cx={285} cy={145} r={20} fill="#C89066" />
  </Svg>
);

// ============================================================
// EYES — белки с обводкой и зрачки с бликами
// ============================================================
export const EyeWhiteLPart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Circle cx={160} cy={195} r={22} fill="#FFFFFF" {...outline} />
  </Svg>
);
export const EyeWhiteRPart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Circle cx={240} cy={195} r={22} fill="#FFFFFF" {...outline} />
  </Svg>
);
export const PupilLPart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Circle cx={160} cy={197} r={13} fill="#1A0F08" />
    <Circle cx={164} cy={192} r={4} fill="#FFFFFF" />
    <Circle cx={157} cy={204} r={2} fill="#FFFFFF" />
  </Svg>
);
export const PupilRPart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Circle cx={240} cy={197} r={13} fill="#1A0F08" />
    <Circle cx={244} cy={192} r={4} fill="#FFFFFF" />
    <Circle cx={237} cy={204} r={2} fill="#FFFFFF" />
  </Svg>
);

// В новом дизайне (глаза с чёрной обводкой) отдельные верхние/нижние веки
// не рисуются — блик и обводка уже дают правильный контур. Компоненты
// оставлены пустыми ради обратной совместимости с BearRig.js.
export const EyelidUpperLPart = () => null;
export const EyelidUpperRPart = () => null;
export const EyelidLowerLPart = () => null;
export const EyelidLowerRPart = () => null;

// ============================================================
// BROWS — 3 варианта × 2 стороны (толстые тёмные)
// ============================================================
const brow = (d) => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path d={d} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />
  </Svg>
);
export const BrowLNeutral = () => brow('M 138 165 Q 158 155 178 165');
export const BrowLUp = () => brow('M 135 152 Q 158 138 180 152');
export const BrowLDown = () => brow('M 140 172 Q 160 182 180 168');
export const BrowRNeutral = () => brow('M 222 165 Q 242 155 262 165');
export const BrowRUp = () => brow('M 220 152 Q 242 138 265 152');
export const BrowRDown = () => brow('M 220 168 Q 240 182 260 172');

// ============================================================
// NOSE — чёрный, приплюснутый
// ============================================================
export const NosePart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path
      d="M 200 225 Q 214 227 214 240 Q 210 250 200 251 Q 190 250 186 240 Q 186 227 200 225 Z"
      fill="#1A0F08"
      {...outlineThin}
    />
    <Ellipse cx={196} cy={232} rx={3} ry={2} fill="#4A3020" />
  </Svg>
);

// ============================================================
// MOUTHS — 6 вариантов
// ============================================================
export const MouthClosed = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path d="M 200 251 L 200 265" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    <Path d="M 182 270 Q 200 278 218 270" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
  </Svg>
);
export const MouthSmileSmall = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path d="M 200 251 L 200 263" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    <Path d="M 180 267 Q 200 283 220 267" stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
  </Svg>
);
export const MouthSmileBig = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path d="M 200 251 L 200 262" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    <Path
      d="M 170 265 Q 200 295 230 265 Q 220 292 200 293 Q 180 292 170 265 Z"
      fill={INK}
      stroke={INK}
      strokeWidth={1}
    />
    {/* Язычок */}
    <Path
      d="M 185 278 Q 200 285 215 278 Q 210 285 200 286 Q 190 285 185 278"
      fill="#E85D6C"
    />
  </Svg>
);
export const MouthOpen = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path d="M 200 251 L 200 262" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    <Ellipse cx={200} cy={273} rx={14} ry={9} fill={INK} {...outlineThin} />
    <Ellipse cx={200} cy={277} rx={8} ry={4} fill="#E85D6C" />
  </Svg>
);
export const MouthSad = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path d="M 200 251 L 200 265" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    <Path d="M 182 278 Q 200 262 218 278" stroke={INK} strokeWidth={3.5} fill="none" strokeLinecap="round" />
  </Svg>
);
export const MouthO = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path d="M 200 251 L 200 262" stroke={INK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    <Ellipse cx={200} cy={275} rx={8} ry={10} fill={INK} {...outlineThin} />
  </Svg>
);

// ============================================================
// BLUSH — розовые пятна на щеках
// ============================================================
export const BlushPart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Ellipse cx={130} cy={230} rx={14} ry={8} fill="#F5A8A0" opacity={0.75} />
    <Ellipse cx={270} cy={230} rx={14} ry={8} fill="#F5A8A0" opacity={0.75} />
  </Svg>
);

// ============================================================
// ARMS — опущены, чуть отходят наружу
// ============================================================
export const ArmLPart = () => (
  <Svg viewBox={BODY_VB} width="100%" height="100%">
    {/* Рукав пиджака */}
    <Path
      d="M 130 302 Q 108 320 100 355 Q 92 385 100 400 Q 118 405 128 395 Q 138 365 148 335 Q 156 315 158 302 Z"
      fill="#3D2A1B"
      {...outline}
    />
    {/* Манжет рубашки */}
    <Path
      d="M 100 395 Q 105 408 118 408 L 130 405 Q 132 397 128 393 Z"
      fill="#F0E8D8"
      {...outlineThin}
    />
    {/* Лапа */}
    <Ellipse cx={112} cy={415} rx={15} ry={13} fill="#7B4823" {...outline} />
    <Ellipse cx={112} cy={418} rx={9} ry={6} fill="#C89066" />
  </Svg>
);

export const ArmRPart = () => (
  <Svg viewBox={BODY_VB} width="100%" height="100%">
    <Path
      d="M 270 302 Q 292 320 300 355 Q 308 385 300 400 Q 282 405 272 395 Q 262 365 252 335 Q 244 315 242 302 Z"
      fill="#3D2A1B"
      {...outline}
    />
    <Path
      d="M 300 395 Q 295 408 282 408 L 270 405 Q 268 397 272 393 Z"
      fill="#F0E8D8"
      {...outlineThin}
    />
    <Ellipse cx={288} cy={415} rx={15} ry={13} fill="#7B4823" {...outline} />
    <Ellipse cx={288} cy={418} rx={9} ry={6} fill="#C89066" />
  </Svg>
);

// ============================================================
// OVERLAYS — слеза, звёздочки, звёзды в глазах, «?», «Zzz», сердечки
// ============================================================
export const TearPart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path
      d="M 150 210 Q 148 235 152 250 Q 156 235 154 210 Q 152 205 150 210 Z"
      fill="#5BAAE8"
      stroke="#3A8AC8"
      strokeWidth={1.5}
    />
    <Circle cx={152} cy={220} r={1.5} fill="#FFFFFF" />
  </Svg>
);

export const SparklePart = ({ color = '#FFE066' } = {}) => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Polygon
      points="200,160 210,190 240,190 215,210 225,240 200,225 175,240 185,210 160,190 190,190"
      fill={color}
      stroke="#B8801A"
      strokeWidth={1}
    />
  </Svg>
);

export const StarEyePart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Polygon
      points="200,180 206,192 219,192 208,201 212,214 200,206 188,214 192,201 181,192 194,192"
      fill="#FFD54A"
      stroke="#B8801A"
      strokeWidth={2}
      strokeLinejoin="round"
    />
  </Svg>
);

export const ZzzPart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path
      d="M 285 145 h 30 l -30 40 h 30"
      stroke="#5BAAE8"
      strokeWidth={5}
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <Path
      d="M 315 105 h 22 l -22 30 h 22"
      stroke="#5BAAE8"
      strokeWidth={4}
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <Path
      d="M 340 75 h 15 l -15 20 h 15"
      stroke="#5BAAE8"
      strokeWidth={3}
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </Svg>
);

export const QuestionMarkPart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path
      d="M 175 55 Q 175 25 205 25 Q 235 25 235 55 Q 235 75 215 85 Q 205 90 205 105"
      stroke="#5BAAE8"
      strokeWidth={10}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx={205} cy={125} r={7} fill="#5BAAE8" />
  </Svg>
);

export const HeartPart = () => (
  <Svg viewBox={FACE_VB} width="100%" height="100%">
    <Path
      d="M 200 130 Q 155 90 155 60 Q 155 40 175 40 Q 190 40 200 55 Q 210 40 225 40 Q 245 40 245 60 Q 245 90 200 130 Z"
      fill="#FF6B8A"
      stroke="#C64560"
      strokeWidth={2}
    />
  </Svg>
);
