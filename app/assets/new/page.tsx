import { AssetForm } from "@/components/assets/asset-form";
import { BulkAssetForm } from "@/components/assets/bulk-asset-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirePageAdmin } from "@/lib/server-auth";

export default async function NewAssetPage() {
  await requirePageAdmin();

  return (
    <div className="container mx-auto space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <div>
        <h1 className="text-2xl font-bold">Create Asset</h1>
        <p className="text-sm text-muted-foreground">
          Create a new asset record and print the QR label for field use.
        </p>
      </div>

      <Tabs defaultValue="single">
        <TabsList>
          <TabsTrigger value="single">Single Asset</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Asset</TabsTrigger>
        </TabsList>

        <TabsContent value="single">
          <Card>
            <CardContent>
              <AssetForm mode="create" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card>
            <CardContent>
              <BulkAssetForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}