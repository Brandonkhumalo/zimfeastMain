from django.views.generic import TemplateView
from django.conf import settings
import os

class ReactAppView(TemplateView):
    template_name = 'index.html'
    
    def get(self, request, *args, **kwargs):
        dist_path = settings.BASE_DIR.parent / 'dist' / 'public' / 'index.html'
        if not os.path.exists(dist_path):
            from django.http import HttpResponse
            return HttpResponse(
                "React app not built yet. Run 'npm run build' or use the Dev Server workflow.",
                status=503
            )
        return super().get(request, *args, **kwargs)
