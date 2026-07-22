import os
import sys
import re

def analyze_module(module_name):
    base_path = r"D:\wms-vinhgiang_repo\vinh_giang_wms-main\backend\src\modules\master-data"
    module_dir = os.path.join(base_path, module_name)
    
    if not os.path.exists(module_dir):
        print(f"Error: Module directory '{module_dir}' not found.")
        sys.exit(1)
        
    print(f"==================================================")
    print(f" ANALYZING MODULE: {module_name.upper()}")
    print(f" Path: {module_dir}")
    print(f"==================================================")
    
    files = os.listdir(module_dir)
    controller_file = [f for f in files if "controller" in f]
    service_file = [f for f in files if "service" in f]
    
    if controller_file:
        c_path = os.path.join(module_dir, controller_file[0])
        print(f"\n--- CONTROLLER: {controller_file[0]} ---")
        with open(c_path, "r", encoding="utf-8") as f:
            content = f.read()
            # Find routes and schemas
            routes = re.findall(r"@(Get|Post|Put|Patch|Delete)\((.*?)\)", content)
            print("Detected Routes & HTTP Methods:")
            for method, path in routes:
                print(f"  - [{method}] {path.strip() or '/'}")
            
            schemas = re.findall(r"const (\w+Schema) = (.*?);", content, re.DOTALL)
            if schemas:
                print("\nValidation Schemas (Zod):")
                for name, body in schemas:
                    clean_body = re.sub(r"\s+", " ", body)
                    print(f"  - {name}: {clean_body[:100]}...")
                    
    if service_file:
        s_path = os.path.join(module_dir, service_file[0])
        print(f"\n--- SERVICE: {service_file[0]} ---")
        with open(s_path, "r", encoding="utf-8") as f:
            content = f.read()
            # Find prisma calls
            prisma_calls = re.findall(r"this\.prisma\.(\w+)\.(\w+)\(", content)
            if prisma_calls:
                print("Database Model Operations (Prisma):")
                unique_ops = set(f"  - model: {model}, operation: {op}" for model, op in prisma_calls)
                for op in sorted(unique_ops):
                    print(op)
            
            # Look for soft-delete or in-use check
            print("\nBusiness/Validation Logic Checks:")
            if "deletedAt" in content:
                print("  - [x] Contains soft-delete logic (deletedAt)")
            if "_count" in content or "count" in content:
                print("  - [x] Contains relation check or count check before deletion (in-use check)")
            if "throw new" in content:
                exceptions = re.findall(r"throw new (\w+Exception)\((.*?)\)", content)
                for exc, msg in exceptions:
                    print(f"  - Exception: {exc} with message: {msg.strip()}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: uv run port_helper.py <module_name>")
        print("Example modules: categories, units, suppliers, locations, products")
        sys.exit(1)
    analyze_module(sys.argv[1])
