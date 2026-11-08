/**
 * Remove only the two iQIYI home ad card shapes seen in the 2026-11-08 HAR.
 * Unknown responses and ordinary content cards pass through unchanged.
 */

const homeEndpoint = /^https?:\/\/cards\.iqiyi\.com\/views_home\/3\.0\/qy_home(?:\?|$)/;
const hasOwn = (value, key) =>
  value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, key);

function isMarkedFocusAd(card) {
  if (!card || typeof card !== "object") return false;
  const stats = card && card.statistics;
  const blocks = card && card.blocks;

  return (
    card.card_type === 7 &&
    card.card_class === "card_r1_cN_focus" &&
    stats && stats.ad_type === "focus" &&
    stats.is_cupid === 2 &&
    Array.isArray(blocks) &&
    blocks.length > 0 &&
    blocks.every(
      (block) =>
        hasOwn(block && block.statistics, "ad_index") &&
        Array.isArray(block.buttons) &&
        block.buttons.some((button) => button && button.text === "广告")
    )
  );
}

function isMarkedNativeAd(card) {
  if (!card || typeof card !== "object") return false;
  const stats = card && card.statistics;
  const blocks = card && card.blocks;

  return (
    card.card_type === 189 &&
    card.card_class === "card_r1_cN_adfeed" &&
    typeof card.name === "string" &&
    card.name.includes("广告") &&
    stats && stats.ad_type === "native_video" &&
    stats.is_cupid === 2 &&
    Array.isArray(blocks) &&
    blocks.some(
      (block) =>
        block &&
        Array.isArray(block.metas) &&
        block.metas.some(
          (meta) => meta && typeof meta.text === "string" && meta.text.includes("广告")
        )
    )
  );
}

try {
  if (!homeEndpoint.test($request.url)) {
    $done();
  } else {
    const payload = JSON.parse($response.body);
    const cards = payload && payload.cards;

    if (payload.code !== 0 || !Array.isArray(cards)) {
      $done();
    } else {
      const retained = cards.filter(
        (card) => !isMarkedFocusAd(card) && !isMarkedNativeAd(card)
      );
      $done(retained.length === cards.length ? undefined : { body: JSON.stringify({ ...payload, cards: retained }) });
    }
  }
} catch (_) {
  $done();
}
