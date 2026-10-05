import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { SCIENCE_AND_HUMANITIES } from '../functions/academic-policy.js';

export const DEFAULT_CATALOG = {
  institutions: [
    {name:'STUDY WORLD COLLEGE OF ENGINEERING',departments:['COMPUTER SCIENCE AND ENGINEERING','ARTIFICAL INTELLIGENCE AND DATA SCIENE','ARTIFICAL INTELLIGENCE AND MACHINE LEARNING','INFORMAION AND TECHNOLOGY','CYBER SECURITY','ELECTRICAL AND ELECTRONICS ENGINEERING','ELECTRONICS AND COMMUNICATION ENGINEERING','MECHNICAL ENGINEERING',SCIENCE_AND_HUMANITIES]},
    {name:'STUDY WORLD COLLEGE OF ARTS AND SCIENCE',departments:['(B. Com) Computer Application','(BBA) Bachelor of Business Administration','(BBA) Logistics & Supply Chain Management','(BCA) Bachelor of Computer Application','(B. Sc.) AI & DS','(B.Sc.) Computer Science','(B.Sc.) Information Technology','(B.Sc.) Clinical Psychology']},
    {name:'STUDY WORLD COLLEGE OF ALLIED AND HEALTH SCIENCE',departments:['(B.Sc.) Cardiac Technology','(B.Sc.) Medical Laboratory Technology','(B.Sc.) Operation Theatre and Anaesthesia','(B.Sc.) Radiography and Imaging Technology']},
  ],
  years:[1,2,3,4],sections:['A','B','C'],
};

export function validateCatalog(catalog) {
  if(!Array.isArray(catalog.institutions)||!catalog.institutions.length||catalog.institutions.length>20)return 'Add between 1 and 20 institutions.';
  const names=new Set();
  for(const institute of catalog.institutions){
    if(typeof institute.name!=='string'||!institute.name.trim()||institute.name.length>160||names.has(institute.name.trim().toLowerCase()))return 'Institution names must be complete and unique.';
    names.add(institute.name.trim().toLowerCase());
    if(!Array.isArray(institute.departments)||!institute.departments.length||institute.departments.length>100)return 'Each institution needs between 1 and 100 departments.';
    const departments=institute.departments.map(x=>String(x).trim().toLowerCase());
    if(departments.some(x=>!x||x.length>160)||new Set(departments).size!==departments.length)return 'Department names must be complete and unique within an institution.';
  }
  if(!Array.isArray(catalog.years)||!catalog.years.length||catalog.years.some(x=>!Number.isInteger(x)||x<1||x>8)||new Set(catalog.years).size!==catalog.years.length)return 'Choose unique academic years from 1 to 8.';
  if(!Array.isArray(catalog.sections)||!catalog.sections.length||catalog.sections.length>50||catalog.sections.some(x=>typeof x!=='string'||!x.trim()||x.length>20)||new Set(catalog.sections.map(x=>x.trim().toUpperCase())).size!==catalog.sections.length)return 'Add unique section names of up to 20 characters.';
  return '';
}
const Context=createContext({catalog:DEFAULT_CATALOG,error:'',setCatalog:()=>{}});
export function AcademicCatalogProvider({children}) {
  const [catalog,setCatalog]=useState(DEFAULT_CATALOG),[error,setError]=useState('');
  useEffect(()=>{if(!db)return;return onSnapshot(doc(db,'settings','academic'),snap=>{if(snap.exists()){const data=snap.data();const invalid=validateCatalog(data);if(invalid){setError(invalid);return;}setCatalog({institutions:data.institutions,years:data.years,sections:data.sections});}setError('');},()=>setError('Academic settings could not be loaded. The default options are available.'));},[]);
  return <Context.Provider value={{catalog,error,setCatalog}}>{children}</Context.Provider>;
}
export const useAcademicCatalog=()=>useContext(Context);
