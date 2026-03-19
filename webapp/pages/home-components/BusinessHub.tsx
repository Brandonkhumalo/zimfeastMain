import { Button } from "@/components/ui/button";

export function BusinessHub() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Join ZimFeast as a Business Partner</h2>
        <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
          Are you a restaurant owner or a delivery driver looking to grow your business with ZimFeast? 
          Join our platform today and reach thousands of customers across Zimbabwe.
        </p>
        <Button 
          onClick={() => window.location.href = '/business-hub'}
          size="lg"
          className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
        >
          <i className="fas fa-handshake mr-2"></i>
          Join Business Hub
        </Button>
      </div>
    </section>
  );
}
