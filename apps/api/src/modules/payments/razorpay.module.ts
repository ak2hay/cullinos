import { Module } from "@nestjs/common";
import { RazorpayClient } from "./razorpay.client";

@Module({
  providers: [RazorpayClient],
  exports: [RazorpayClient],
})
export class RazorpayModule {}
