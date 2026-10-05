const ROOT_FIELDS = ["schemaVersion", "updatedAt", "ratingCount", "ratingSum", "featured"];
const REVIEW_FIELDS = ["id", "rating", "comment", "displayName"];
const DATED_REVIEW_FIELDS = [...REVIEW_FIELDS, "date", "dateType"];

function exactFields(value, fields) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
}

function validCalendarDay(value) {
  if (typeof value !== "string" || value.length !== 10 || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function validReviewFields(review) {
  return exactFields(review, REVIEW_FIELDS) ||
    (exactFields(review, DATED_REVIEW_FIELDS) && validCalendarDay(review.date) &&
      (review.dateType === "submitted" || review.dateType === "imported"));
}

function validCollection(reviews) {
  const ids = new Set();
  return Array.from(reviews).every(review => {
    if (!validReviewFields(review) || typeof review.id !== "string" ||
        !/^[a-f0-9]{16}$/.test(review.id) || ids.has(review.id) ||
        !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5 ||
        typeof review.comment !== "string" || !review.comment.trim() || [...review.comment].length > 600 ||
        typeof review.displayName !== "string" || [...review.displayName].length > 60) return false;
    ids.add(review.id);
    return true;
  });
}

export function isValidReviews(data) {
  const v2 = data?.schemaVersion === 2;
  if (!exactFields(data, v2 ? [...ROOT_FIELDS, "reviews"] : ROOT_FIELDS) ||
      (!v2 && data.schemaVersion !== 1) || typeof data.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(data.updatedAt)) || !Number.isSafeInteger(data.ratingCount) ||
      data.ratingCount < 0 || data.ratingCount > Math.floor(Number.MAX_SAFE_INTEGER / 5) ||
      !Number.isSafeInteger(data.ratingSum) || data.ratingSum < data.ratingCount ||
      data.ratingSum > data.ratingCount * 5 || !Array.isArray(data.featured) ||
      data.featured.length > Math.min(10, data.ratingCount) || !validCollection(data.featured)) return false;
  const collection = v2 ? data.reviews : data.featured;
  if (v2) {
    if (!Array.isArray(collection) || collection.length > Math.min(5000, data.ratingCount) ||
        !validCollection(collection)) return false;
    const byId = new Map(collection.map(review => [review.id, review]));
    if (!data.featured.every(review => {
      const match = byId.get(review.id);
      return match && DATED_REVIEW_FIELDS.every(field => match[field] === review[field]);
    })) return false;
  }
  const sum = collection.reduce((total, review) => total + review.rating, 0);
  const remaining = data.ratingCount - collection.length;
  return data.ratingSum >= sum + remaining && data.ratingSum <= sum + remaining * 5;
}
