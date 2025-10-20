import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import SignInRequired from "./business-components/SignInRequired";
import Header from "./business-components/Header";
import InfoSection from "./business-components/InfoSection";
import RestaurantForm from "./business-components/RestaurantForm";
import DriverForm from "./business-components/DriverForm";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function BusinessHub() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("restaurant");

  if (!isAuthenticated) return <SignInRequired />;

  return (
    <div className="min-h-screen bg-background">
      <Header name={user?.first_name} />
      <div className="max-w-4xl mx-auto px-4 py-12">
        <InfoSection />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="restaurant"><i className="fas fa-store mr-2" />Restaurant</TabsTrigger>
            <TabsTrigger value="driver"><i className="fas fa-motorcycle mr-2" />Driver</TabsTrigger>
          </TabsList>

          <TabsContent value="restaurant"><RestaurantForm /></TabsContent>
          <TabsContent value="driver"><DriverForm /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
