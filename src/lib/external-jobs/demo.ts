/**
 * The demo's made-up companies (`demo-…`, src/mock/external-jobs.ts). Their jobs have no real company site: the job
 * page explains 去官网申请 instead of opening an address, and the import never takes them down.
 */
export const isDemoCompany = (companyId: string) => companyId.startsWith("demo-");
