import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/shared/store/auth.store";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
const directory = vi.hoisted(() => ({data: [] as Record<string, unknown>[], isError:false,isPlaceholderData:false}));
vi.mock("@/shared/data/reference-queries", () => ({useWarehouseDirectory: () => directory}));
import { ReportWarehouseCard, resolveReportWarehouse } from "./ReportWarehouseCard";
const warehouse = {id:1,code:"KHO-TONG-HN",name:"Kho Hoa Nam",status:"ACTIVE"};
const context = {role_id:1,role_name:"Warehouse staff",scope_type:"WAREHOUSE",org_unit_id:null,org_unit_name:null,department_id:null,department_name:null,warehouse_id:1,warehouse_name:"Kho Hoa Nam"};
beforeEach(() => {
  directory.data=[warehouse];directory.isError=false;directory.isPlaceholderData=false;
  useAuthStore.setState({isAuthenticated:true,currentContext:context});
  useLanguageStore.setState({language:"vi"});
});
afterEach(() => {cleanup();useAuthStore.setState({isAuthenticated:false,currentContext:null});useLanguageStore.setState({language:"vi"});});
describe("shared inbound-reference warehouse card", () => {
  it("renders the API warehouse and verified active status without a fake dropdown", () => {
    const {container}=render(<ReportWarehouseCard/>);
    expect(screen.getByText("Kho Hoa Nam")).toBeInTheDocument();
    expect(screen.getByText("Đang hoạt động")).toBeInTheDocument();
    expect(container.querySelector('[data-report-warehouse]')).toHaveAttribute('data-state','active');
    expect(container.querySelector('button,summary,select,[role="combobox"]')).toBeNull();
  });
  it("reacts to a warehouse context switch without reusing the previous active label", () => {
    const {container}=render(<ReportWarehouseCard/>);
    act(()=>useAuthStore.setState({currentContext:{...context,warehouse_id:2,warehouse_name:"Second warehouse"}}));
    expect(screen.getByText("Second warehouse")).toBeInTheDocument();
    expect(container.querySelector('[data-report-warehouse]')).toHaveAttribute('data-state','unknown');
    expect(screen.queryByText("Đang hoạt động")).toBeNull();
  });
  it("does not label a suspended warehouse active", () => {
    directory.data=[{...warehouse,status:'INACTIVE'}];
    const {container}=render(<ReportWarehouseCard/>);
    expect(screen.getByText("Ngừng hoạt động")).toBeInTheDocument();
    expect(container.querySelector('[data-report-warehouse]')).toHaveAttribute('data-state','inactive');
  });
  it.each(['error','placeholder','empty','unrecognized'])("does not invent an active status: %s",mode=>{
    if(mode==='error')directory.isError=true;
    if(mode==='placeholder')directory.isPlaceholderData=true;
    if(mode==='empty')directory.data=[];
    if(mode==='unrecognized')directory.data=[{...warehouse,status:'UNRECOGNIZED'}];
    const {container}=render(<ReportWarehouseCard/>);
    expect(container.querySelector('[data-report-warehouse]')).toHaveAttribute('data-state','unknown');
    expect(screen.queryByText("Đang hoạt động")).toBeNull();
  });
  it("translates the status immediately but preserves the actual warehouse name", async()=>{
    await ensureEnglishMessages();render(<ReportWarehouseCard/>);
    act(()=>useLanguageStore.setState({language:'en'}));
    expect(screen.queryByText('Đang hoạt động')).toBeNull();
    expect(screen.getByText('Kho Hoa Nam')).toBeInTheDocument();
    expect(document.querySelector('.hn-report-warehouse__status')).toHaveTextContent('Active');
  });
  it("retains the complete name in an accessible title for long API names",()=>{
    const name='API warehouse '.repeat(30);directory.data=[{...warehouse,name}];render(<ReportWarehouseCard/>);
    expect(document.querySelector('.hn-report-warehouse__name')).toHaveAttribute('title',name.trim());
  });
  it("does not display another warehouse just because it is the first directory entry",()=>{
    expect(resolveReportWarehouse([{...warehouse,id:2}],context,true)).toEqual({name:'Kho Hoa Nam',state:'unknown'});
  });
  it("resolves canonical warehouse for a global context, not an arbitrary row",()=>{
    expect(resolveReportWarehouse([{id:2,name:'Other',code:'OTHER',status:'ACTIVE'},warehouse],{warehouse_id:null},true)).toEqual({name:'Kho Hoa Nam',state:'active'});
  });
  it("does not resolve an ambiguous directory match",()=>{
    expect(resolveReportWarehouse([warehouse,warehouse],context,true).state).toBe('unknown');
  });
  it("accepts string IDs returned by the API",()=>{
    expect(resolveReportWarehouse([{...warehouse,id:'1'}],context,true).state).toBe('active');
  });
  it("never uses persisted directory data after logout",()=>{
    useAuthStore.setState({isAuthenticated:false,currentContext:null});const {container}=render(<ReportWarehouseCard/>);
    expect(container.querySelector('[data-report-warehouse]')).toHaveAttribute('data-state','unknown');
    expect(screen.queryByText('Kho Hoa Nam')).toBeNull();
  });
});
