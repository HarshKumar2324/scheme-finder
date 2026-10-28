function getField(user, field) {
  return user[field];
}

function evaluateSimpleRule(user, rule) {
  const actual = getField(user, rule.field);
  const { op, value } = rule;

  if (actual === undefined || actual === null) {
    return false;
  }

  switch (op) {
    case "eq":
      return actual === value;
    case "in":
      return Array.isArray(value) && value.includes(actual);
    case "between":
      return (
        Array.isArray(value) &&
        value.length === 2 &&
        typeof actual === "number" &&
        actual >= value[0] &&
        actual <= value[1]
      );
    case "min":
      return typeof actual === "number" && actual >= value;
    case "max":
      return typeof actual === "number" && actual <= value;
    default:
      return false;
  }
}

function rulePasses(user, rule) {
  if (Array.isArray(rule.anyOf)) {
    return rule.anyOf.some((inner) => rulePasses(user, inner));
  }
  return evaluateSimpleRule(user, rule);
}

function evaluateScheme(user, scheme) {
  const passed = [];
  const failed = [];

  for (const rule of scheme.rules) {
    const label = { en: rule.label_en, hi: rule.label_hi };
    if (rulePasses(user, rule)) {
      passed.push(label);
    } else {
      failed.push(label);
    }
  }

  let status;
  if (failed.length === 0) {
    status = "eligible";
  } else if (failed.length === 1) {
    status = "almost";
  } else {
    status = "not_eligible";
  }

  return {
    id: scheme.id,
    name: scheme.name,
    benefit: scheme.benefit,
    benefitValue: scheme.benefitValue,
    applyUrl: scheme.applyUrl,
    status,
    passed,
    failed,
    documents: scheme.documents,
  };
}

const STATUS_ORDER = { eligible: 0, almost: 1, not_eligible: 2 };

function checkEligibility(user, schemes) {
  const results = schemes.map((scheme) => evaluateScheme(user, scheme));
  results.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const eligible = results.filter((r) => r.status === "eligible");
  const almost = results.filter((r) => r.status === "almost");
  const notEligible = results.filter((r) => r.status === "not_eligible");
  const totalAnnualBenefit = eligible.reduce(
    (sum, r) => sum + (r.benefitValue || 0),
    0
  );

  return {
    summary: {
      eligible: eligible.length,
      almost: almost.length,
      notEligible: notEligible.length,
      totalAnnualBenefit,
    },
    results,
  };
}

module.exports = {
  checkEligibility,
  evaluateScheme,
  rulePasses,
};
