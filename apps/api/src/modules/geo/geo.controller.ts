import { BadRequestException, Controller, Get, Param } from "@nestjs/common";
import { Public } from "../../common/decorators";

@Controller("geo")
export class GeoController {
  @Public()
  @Get("pincode/:pin")
  async lookupPincode(@Param("pin") pin: string) {
    const cleaned = pin?.trim() ?? "";
    if (!/^\d{6}$/.test(cleaned)) {
      throw new BadRequestException("Pincode must be 6 digits");
    }

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleaned}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        throw new BadRequestException("Pincode lookup failed");
      }
      const data = (await res.json()) as Array<{
        Status?: string;
        PostOffice?: Array<{ District?: string; State?: string; Name?: string }>;
      }>;
      const entry = Array.isArray(data) ? data[0] : null;
      const office = entry?.PostOffice?.[0];
      if (entry?.Status !== "Success" || !office) {
        return { found: false, pincode: cleaned, city: null, state: null };
      }
      return {
        found: true,
        pincode: cleaned,
        city: office.District || office.Name || null,
        state: office.State || null,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException("Pincode lookup unavailable");
    }
  }
}
