import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
 assertRoutePermission,
 createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
 BillingRefundError,
 createBillingRefund,
 listCompanyBillingRefunds,
} from "@/server/services/billing-refund.service";

const CreateRefundSchema = z.object({
 invoiceId: z.string().min(1),
 amountPaise: z.number().int().positive(),
 reason: z.string().max(2000).optional().nullable(),
 confirmation: z.string().optional().nullable(),
 downgradeAfterFullRefund: z.boolean().default(true),
});

export async function GET(request: Request) {
 let workspace;

 try {
   workspace = await requireAdmin({ request });
 } catch (error) {
   return createAuthorizationErrorResponse(error);
 }

 try {
   await assertRoutePermission({
     request,
     workspace,
     permission: "BILLING_MANAGE",
   });
 } catch (error) {
   return createRoutePermissionErrorResponse(error);
 }

 const refunds = await listCompanyBillingRefunds({
   companyId: workspace.membership.companyId,
 });

 return NextResponse.json({
   ok: true,
   refunds,
 });
}

export async function POST(request: Request) {
 let workspace;

 try {
   workspace = await requireAdmin({ request });
 } catch (error) {
   return createAuthorizationErrorResponse(error);
 }

 try {
   await assertRoutePermission({
     request,
     workspace,
     permission: "BILLING_MANAGE",
   });
 } catch (error) {
   return createRoutePermissionErrorResponse(error);
 }

 try {
   const body = CreateRefundSchema.parse(await request.json());

   const result = await createBillingRefund({
     companyId: workspace.membership.companyId,
     requestedByUserId: workspace.user.id,
     invoiceId: body.invoiceId,
     amountPaise: body.amountPaise,
     reason: body.reason,
     confirmation: body.confirmation,
     downgradeAfterFullRefund: body.downgradeAfterFullRefund,
   });

   return NextResponse.json({
     ok: true,
     result,
   });
 } catch (error) {
   if (error instanceof BillingRefundError) {
     return NextResponse.json(
       {
         ok: false,
         code: "BILLING_REFUND_ERROR",
         message: error.message,
       },
       {
         status: 400,
       },
     );
   }

   throw error;
 }
}
