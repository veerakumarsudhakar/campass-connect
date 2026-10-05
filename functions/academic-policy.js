export const SCIENCE_AND_HUMANITIES = 'SCIENCE AND HUMANITIES (S&H)';
export const isScienceAndHumanities = department => ['S&H', 'SCIENCE AND HUMANITIES', SCIENCE_AND_HUMANITIES].includes(String(department || '').trim().toUpperCase());
export const canonicalDepartment = value => {
  const text = String(value || '').trim();
  return isScienceAndHumanities(text) ? SCIENCE_AND_HUMANITIES : text;
};
export const isEngineering = institution => String(institution || '').toUpperCase().includes('ENGINEERING');
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

export function matchesStaffScope(record, user) {
  const role=user.role, common=isCommonFirstYear(user);
  const institution=!role || ['Class Advisor','HOD','Principal'].includes(role);
  const department=!role || ['Class Advisor','HOD'].includes(role);
  const year=!role || ['Class Advisor','Year Warden'].includes(role);
  const hostel=!role || ['Year Warden','Resident Councillor'].includes(role);
  const hostelName=record.hostel || (record.gender==='Male'?'Boys hostel':record.gender==='Female'?'Girls hostel':'Hostel assignment required');
  return (!institution || !user.institution || record.institution===user.institution)
    && (common ? isEngineering(user.institution) && isEngineering(record.institution) && Number(record.year)===1 : !department || !user.department || record.department===user.department)
    && (common || !year || !user.year || Number(record.year)===Number(user.year))
    && (role!=='Class Advisor' || !user.section || record.section===user.section)
    && (!hostel || !user.hostel || hostelName===user.hostel);
}
