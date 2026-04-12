import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPropertySchema, type Property, type InsertProperty } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const formSchema = insertPropertySchema.extend({
  squareFeet: z.coerce.number().positive("Must be positive"),
  lotSize: z.coerce.number().positive().nullable().optional(),
  yearBuilt: z.coerce.number().int().min(1800).max(2030).nullable().optional(),
  bedrooms: z.coerce.number().int().min(0).nullable().optional(),
  bathrooms: z.coerce.number().min(0).nullable().optional(),
  units: z.coerce.number().int().min(1).nullable().optional(),
  listPrice: z.coerce.number().positive().nullable().optional(),
  salePrice: z.coerce.number().positive().nullable().optional(),
  noi: z.coerce.number().positive().nullable().optional(),
  grossRent: z.coerce.number().positive().nullable().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface PropertyFormProps {
  isSubject: boolean;
  existingProperty?: Property | null;
  projectId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PropertyForm({ isSubject, existingProperty, projectId, onSuccess, onCancel }: PropertyFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: existingProperty
      ? {
          ...existingProperty,
          isSubject: existingProperty.isSubject,
        }
      : {
          address: "",
          city: "",
          state: "",
          zip: "",
          propertyType: "residential",
          squareFeet: 0,
          lotSize: null,
          yearBuilt: null,
          bedrooms: null,
          bathrooms: null,
          units: null,
          listPrice: null,
          salePrice: null,
          noi: null,
          grossRent: null,
          saleDate: null,
          notes: null,
          isSubject: isSubject,
        },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        projectId: existingProperty?.projectId ?? projectId,
        isSubject: isSubject || (existingProperty?.isSubject ?? false),
        lotSize: data.lotSize || null,
        yearBuilt: data.yearBuilt || null,
        bedrooms: data.bedrooms || null,
        bathrooms: data.bathrooms || null,
        units: data.units || null,
        listPrice: data.listPrice || null,
        salePrice: data.salePrice || null,
        noi: data.noi || null,
        grossRent: data.grossRent || null,
        saleDate: data.saleDate || null,
        notes: data.notes || null,
      };

      if (existingProperty) {
        await apiRequest("PATCH", `/api/properties/${existingProperty.id}`, payload);
      } else {
        await apiRequest("POST", "/api/properties", payload);
      }
    },
    onSuccess,
  });

  const onSubmit = (data: FormValues) => {
    mutation.mutate(data);
  };

  const propertyType = form.watch("propertyType");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Location */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Location</h4>
        <div>
          <Label htmlFor="address" className="text-xs">Address</Label>
          <Input id="address" {...form.register("address")} placeholder="123 Main St" data-testid="input-address" />
          {form.formState.errors.address && (
            <p className="text-xs text-destructive mt-1">{form.formState.errors.address.message}</p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor="city" className="text-xs">City</Label>
            <Input id="city" {...form.register("city")} placeholder="Philadelphia" data-testid="input-city" />
          </div>
          <div>
            <Label htmlFor="state" className="text-xs">State</Label>
            <Input id="state" {...form.register("state")} placeholder="PA" data-testid="input-state" />
          </div>
          <div>
            <Label htmlFor="zip" className="text-xs">ZIP</Label>
            <Input id="zip" {...form.register("zip")} placeholder="19101" data-testid="input-zip" />
          </div>
        </div>
      </div>

      {/* Property Details */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Details</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="propertyType" className="text-xs">Type</Label>
            <Select
              value={form.watch("propertyType")}
              onValueChange={(v) => form.setValue("propertyType", v)}
            >
              <SelectTrigger data-testid="select-property-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="residential">Residential</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="multifamily">Multifamily</SelectItem>
                <SelectItem value="industrial">Industrial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="squareFeet" className="text-xs">Square Feet</Label>
            <Input
              id="squareFeet"
              type="number"
              {...form.register("squareFeet", { valueAsNumber: true })}
              data-testid="input-sqft"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor="yearBuilt" className="text-xs">Year Built</Label>
            <Input id="yearBuilt" type="number" {...form.register("yearBuilt")} data-testid="input-year-built" />
          </div>
          <div>
            <Label htmlFor="lotSize" className="text-xs">Lot (acres)</Label>
            <Input id="lotSize" type="number" step="0.01" {...form.register("lotSize")} data-testid="input-lot-size" />
          </div>
          {(propertyType === "residential" || propertyType === "multifamily") && (
            <div>
              <Label htmlFor="bedrooms" className="text-xs">Beds</Label>
              <Input id="bedrooms" type="number" {...form.register("bedrooms")} data-testid="input-beds" />
            </div>
          )}
        </div>
        {(propertyType === "residential" || propertyType === "multifamily") && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="bathrooms" className="text-xs">Baths</Label>
              <Input id="bathrooms" type="number" step="0.5" {...form.register("bathrooms")} data-testid="input-baths" />
            </div>
            {propertyType === "multifamily" && (
              <div>
                <Label htmlFor="units" className="text-xs">Units</Label>
                <Input id="units" type="number" {...form.register("units")} data-testid="input-units" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Financial */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Financial</h4>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="listPrice" className="text-xs">List Price</Label>
            <Input id="listPrice" type="number" {...form.register("listPrice")} placeholder="$" data-testid="input-list-price" />
          </div>
          {!isSubject && (
            <div>
              <Label htmlFor="salePrice" className="text-xs">Sale Price</Label>
              <Input id="salePrice" type="number" {...form.register("salePrice")} placeholder="$" data-testid="input-sale-price" />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="noi" className="text-xs">NOI (Annual)</Label>
            <Input id="noi" type="number" {...form.register("noi")} placeholder="$" data-testid="input-noi" />
          </div>
          <div>
            <Label htmlFor="grossRent" className="text-xs">Gross Rent (Annual)</Label>
            <Input id="grossRent" type="number" {...form.register("grossRent")} placeholder="$" data-testid="input-gross-rent" />
          </div>
        </div>
        {!isSubject && (
          <div>
            <Label htmlFor="saleDate" className="text-xs">Sale Date</Label>
            <Input id="saleDate" type="date" {...form.register("saleDate")} data-testid="input-sale-date" />
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes" className="text-xs">Notes</Label>
        <Textarea id="notes" {...form.register("notes")} placeholder="Additional notes..." rows={2} data-testid="input-notes" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} data-testid="button-cancel">
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={mutation.isPending} data-testid="button-submit-property">
          {mutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
          {existingProperty ? "Update" : "Add"} Property
        </Button>
      </div>
    </form>
  );
}
