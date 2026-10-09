export const SCIENCE_AND_HUMANITIES = 'SCIENCE AND HUMANITIES (S&H)';
export const isScienceAndHumanities = department => ['S&H', 'SCIENCE AND HUMANITIES', SCIENCE_AND_HUMANITIES].includes(String(department || '').trim().toUpperCase());
export const canonicalDepartment = value => {
  const text = String(value || '').trim();
  return isScienceAndHumanities(text) ? SCIENCE_AND_HUMANITIES : text;
};
export const isEngineering = institution => String(institution || '').toUpperCase().includes('ENGINEERING');
export const WARDEN_COVERAGE = { ENGINEERING: { label: 'Engineering', years: [1,2,3,4] }, ARTS_SCIENCE: { label: 'Arts and Science', years: [1,2,3] }, ALLIED_HEALTH: { label: 'Allied Health Science', years: [1,2,3] } };
export function institutionGroup(institution) {
  const name=String(institution||'').toUpperCase();
  return name.includes('ENGINEERING') ? 'ENGINEERING' : name.includes('ARTS') && name.includes('SCIENCE') ? 'ARTS_SCIENCE' : name.includes('ALLIED') && name.includes('HEALTH') ? 'ALLIED_HEALTH' : '';
}
export const coverageKey = (group,year) => `${group}:${year}`;
export function normalizeWardenCoverage(value) {
  return [...new Set((Array.isArray(value)?value:[]).filter(item=>typeof item==='string' && Object.entries(WARDEN_COVERAGE).some(([group,data])=>data.years.some(year=>item===coverageKey(group,year)))))];
}
export function wardenCoverageLabel(value) {
  return normalizeWardenCoverage(value).map(item=>{const [group,year]=item.split(':');return `Year ${year} ${WARDEN_COVERAGE[group].label}`;});
}
export const isCommonFirstYear = user => ['Class Advisor', 'HOD'].includes(user.role || user.requestedRole) && isScienceAndHumanities(user.department);

function unique(values, key) {
  const seen = new Set(), result = [];
  for (const value of values) {
    const id = key(value);
    if (id === '' || id === undefined || id === null || seen.has(id)) continue;
    seen.add(id);
    result.push(value);
  }
  return result;
}
export function normalizeCatalog(catalog) {
  return {
    institutions: (Array.isArray(catalog?.institutions) ? catalog.institutions : []).map(item => ({
      name: String(item?.name || '').trim(),
      departments: unique((Array.isArray(item?.departments) ? item.departments : []).map(canonicalDepartment), value => value.toLowerCase()),
    })),
    years: unique([1, ...(Array.isArray(catalog?.years) ? catalog.years : [])].map(value => Number(String(value).trim())), value => value),
    sections: unique((Array.isArray(catalog?.sections) ? catalog.sections : []).map(value => String(value || '').trim().toUpperCase()), value => value),
  };
}
export function normalizeSections(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(list.map(item => String(item || '').trim().toUpperCase()).filter(Boolean))].slice(0, 50);
}
export function sectionSpan(from, to, available) {
  const sections = normalizeSections(available);
  const start = sections.indexOf(String(from || '').trim().toUpperCase());
  const end = sections.indexOf(String(to || '').trim().toUpperCase());
  if (start < 0 || end < 0) return [];
  const [first, last] = start <= end ? [start, end] : [end, start];
  return sections.slice(first, last + 1);
}
export function formatSections(value) {
  const list = normalizeSections(value);
  if (!list.length) return 'No sections assigned';
  const letters = list.every(item => /^[A-Z]$/.test(item));
  const codes = list.map(item => item.charCodeAt(0));
  if (letters && list.length > 1 && codes.every((code, index) => index === 0 || code === codes[index - 1] + 1)) return `${list[0]}–${list.at(-1)}`;
  return list.join(', ');
}
export function withCommonFirstYear(catalog) {
  const normalized = normalizeCatalog(catalog);
  return { ...normalized, institutions: normalized.institutions.map(item => isEngineering(item.name) && !item.departments.some(isScienceAndHumanities) ? { ...item, departments: [...item.departments, SCIENCE_AND_HUMANITIES] } : item) };
}

const coverageGender = user => user.hostel === 'Boys hostel' ? 'Male' : user.hostel === 'Girls hostel' ? 'Female' : '';
const requestGender = record => record.gender === 'Male' || record.gender === 'Female' ? record.gender : record.hostel === 'Boys hostel' ? 'Male' : record.hostel === 'Girls hostel' ? 'Female' : '';
export function matchesStaffScope(record, user) {
  const role=user.role, common=isCommonFirstYear(user);
  const institution=!role || ['Class Advisor','HOD','Principal'].includes(role);
  const department=!role || ['Class Advisor','HOD'].includes(role);
  const year=!role || role === 'Class Advisor';
  const hostelRole=!role||role==='Deputy Warden'||role==='Resident Councillor';
  const hostelName=record.hostel||(record.gender==='Male'?'Boys hostel':record.gender==='Female'?'Girls hostel':'Hostel assignment required');
  const assigned=normalizeSections(user.sections);
  const genderMatch=role?coverageGender(user)!==''&&requestGender(record)===coverageGender(user):!user.hostel||hostelName===user.hostel;
  return (!institution || !user.institution || record.institution===user.institution)
    && (common ? isEngineering(user.institution) && isEngineering(record.institution) && Number(record.year)===1 : !department || !user.department || record.department===user.department)
    && (common || !year || !user.year || Number(record.year)===Number(user.year))
    && (role!=='Class Advisor' || !user.section || String(record.section||'').toUpperCase()===String(user.section).toUpperCase())
    && (!(common && role==='HOD') || assigned.includes(String(record.section||'').trim().toUpperCase()))
    && (!hostelRole || genderMatch)
    && (role!=='Deputy Warden' || normalizeWardenCoverage(user.wardenCoverage).includes(coverageKey(institutionGroup(record.institution),Number(record.year))));
}
